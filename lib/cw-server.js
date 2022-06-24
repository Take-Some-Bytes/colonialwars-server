/* eslint-env node */
/**
 * @fileoverview CWServer class.
 */

const http = require('http')
const debug = require('debug')('colonialwars:cwserver')
const Router = require('router')
const winstonConfig = require('winston/lib/winston/config')

const errors = require('./errors')
const constants = require('./constants')
const Manager = require('./game/manager')
const GameServer = require('./game-server')
const TimedStore = require('./timed-store')
const Loggers = require('./logging/loggers')
const Controllers = require('./controllers/controllers')
const Middlewares = require('./controllers/middlewares')
const ServerConfig = require('./utils/server-config')
const ErrorHandlers = require('./controllers/errorhandlers')

/**
 * CWServer class.
 */
class CWServer {
  /**
   * Constructor for a CWServer class.
   */
  constructor () {
    /**
     * @type {InstanceType<typeof ServerConfig>}
     */
    this.config = {}
    this.initialized = false
  }

  /**
   * Gets self configurations.
   * @private
   */
  _getConfig () {
    try {
      this.config = new ServerConfig({
        config: {
          IS_PROD: process.env.NODE_ENV === 'production'
            ? 'true'
            : 'false',
          ...process.env
        },
        fallbacks: constants.FALLBACKS
      })
    } catch (ex) {
      throw new Error(`Failed to get configurations! Error stack: ${ex.stack}`)
    }
    debug('Got configurations!')
  }

  /**
   * Gets logging configurations.
   * @private
   */
  _initLoggers () {
    const loggerInfos = [
      { id: 'Games-logger', label: 'Games_log' },
      { id: 'Server-logger', label: 'Server_log' },
      { id: 'Security-logger', label: 'Security_log' },
      { id: 'req-logger', label: 'request_log' }
    ]

    this.loggers = new Loggers({
      colourize: true,
      colours: winstonConfig.syslog.colors,
      loggingLevels: winstonConfig.syslog.levels
    })
    loggerInfos.forEach(info => {
      this.loggers.addLogger({
        id: info.id,
        label: info.label,
        useReadableFormat: !this.config.IS_PROD,
        transports: this.config.LOGGING_TRANSPORTS
      })
    })

    // Set up special request logger stream, which we are going to use with morgan.
    this.reqLoggerStream = {
      /**
       * A mock write method to pass to morgan.
       * @param {string} chunk The chunk to write.
       */
      write: (chunk) => {
        const ReqLogger = this.loggers.get('req-logger')
        ReqLogger.info(chunk.slice(0, chunk.lastIndexOf('\n')))
      }
    }

    debug('Initialized application loggers.')
  }

  /**
   * Gets the status of this game server.
   * @returns {Controllers.CWServerStatus}
   */
  _getStatus () {
    return {
      running: true,
      full: this.manager.numClients >= this.config.MAX_CLIENTS,
      capacity: {
        maxClients: this.config.MAX_CLIENTS,
        currentClients: this.manager.numClients
      }
    }
  }

  /**
   * Initializes common helper classes.
   * @private
   */
  _initCommonHelpers () {
    debug('Initialized server utilities.')
    this.authStore = new TimedStore({
      maxItems: this.config.AUTH_STORE_MAX_ENTRIES,
      maxAge: this.config.AUTH_STORE_MAX_ENTRY_AGE,
      // We will NOT reset item age when we access an item.
      strict: true
    })
    debug('Initialized WebSocket authorization storage.')
  }

  /**
   * Initializes helper classes for game managing.
   * @private
   */
  async _initGameHelpers () {
    this.manager = await Manager.create({
      loggers: this.loggers,
      maxGames: this.config.MAX_GAMES,
      startGames: this.config.STARTING_GAME_NUM,
      updateLoopFrequency: this.config.UPDATE_LOOP_FREQUENCY,
      dataFiles: {
        location: this.config.GAME_CONF_BASE_DIR,
        availableMaps: this.config.GAME_CONFS
      }
    })
    debug('Initialized game manager.')
  }

  /**
   * Initializes API application helper classes.
   * @private
   */
  _initAppHelpers () {
    this.middlewares = new Middlewares({
      URL_MAX_LEN: 150,
      debug,
      corsOpts: {
        origin: (origin, cb) => {
          if (this.config.ALLOWED_ORIGINS.includes(origin) || !origin) {
            cb(null, true)
          } else {
            cb(new errors.CorsError('Not allowed by CORS!'))
          }
        },
        methods: constants.APP_OPTS.ALLOWED_METHODS,
        allowedHeaders: ['X-App-Version', 'X-Is-Trusted', 'X-Requested-With'],
        exposedHeaders: [
          'Connection', 'Content-Security-Policy',
          'Date', 'Transfer-Encoding', 'Vary'
        ],
        credentials: true
      },
      requestLoggerStream: this.reqLoggerStream,
      loggers: this.loggers
    })
    debug('Initialized application middlewares.')
    this.controllers = new Controllers({
      isProd: this.config.IS_PROD,
      gameAuthSecret: this.config.GAME_AUTH_SECRET,
      authDB: this.authStore,
      loggers: this.loggers
    })
    debug('Initialized application controllers.')
    this.errorHandlers = new ErrorHandlers({
      loggers: this.loggers
    })
    debug('Initialized application error handlers.')
  }

  /**
   * Initializes this CWServer's API server.
   * @private
   */
  _initApp () {
    this.router = new Router()
    this.router.use(this.middlewares.logRequest())
    this.router.use(this.middlewares.corsCheckpoint())
    this.router.options('*', this.middlewares.corsCheckpoint())
    this.router.use(
      this.middlewares.queryParser(),
      this.middlewares.forwardedParser(),
      this.middlewares.setCSPHeader(),
      this.middlewares.getClientIP({
        behindProxy: this.config.IS_PROD,
        trustedIPs: this.config.TRUSTED_IPS
      }),
      this.middlewares.sysCheckpoint(constants.APP_OPTS.IMPLEMENTED_METHODS),
      this.middlewares.acceptCheckpoint()
    )
    this.router.get('/game-auth/get', this.controllers.gameAuth())
    this.router.get('/status-report', this.controllers.statusReport({
      getStatus: this._getStatus.bind(this)
    }))
    // Register the following handler on /games-info and /games-stats for
    // compatibility reasons.
    this.router.get('/games-info', this.controllers.gamesInfo(this.manager))
    this.router.get('/games-stats', this.controllers.gamesInfo(this.manager))
    // // Here, we need to handle all other unhandled routes.
    this.router.use(this.controllers.unhandled())
    // Lastly, we need to register all the error controllers.
    this.router.use(this.errorHandlers.handleCorsError())
  }

  /**
   * Initializes this CWServer.
   */
  async init () {
    this._getConfig()
    this._initLoggers()
    this._initCommonHelpers()
    this._initAppHelpers()
    await this._initGameHelpers()
    this._initApp()

    this.httpServer = http.createServer((req, res) => {
      const funcs = [this.middlewares.requestID(), this.router]
      let index = 0

      function next (err) {
        if (err) {
          throw err
        }
        funcs[index++](req, res, next)
      }

      next(null)
    })
    // Connection timeout logic.
    this.httpServer.on('connection', socket => {
      socket.setTimeout(this.config.SERVER_CONN_TIMEOUT)
      socket.on('timeout', () => {
        /**
         * CONSIDER: Log this?
         * We may want to log a message when a socket has timed out.
         * (06/01/2021) Take-Some-Bytes */
        // Socket timed out.
        socket.destroy()
      })
    })
    // Set up actual game server, which handles the WebSocket stuff.
    this.gameServer = new GameServer({
      middlewares: this.middlewares,
      gamelogger: this.loggers.get('Games-logger'),
      authStore: this.authStore,
      manager: this.manager,
      config: this.config,
      server: this.httpServer
    })
    this.gameServer.init()

    this.loggers.get('Server-logger').info('Server initialization complete.')

    this.initialized = true
  }

  /**
   * Starts this HTTP server. Returns a promise that resolves to a boolean
   * representing whether whether the server listen procedures have been initiated.
   * @returns {Promise<boolean>}
   */
  start () {
    return new Promise((resolve, reject) => {
      if (!this.initialized) {
        const err = new Error('CWServer is not initialized!')
        err.code = 'ENOTINITIALIZED'

        reject(err)
      } else if (this.httpServer.listening) {
        // We don't want an error to be thrown if the server is already listening,
        // so that's why we do this check here.
        resolve(false)
      } else {
        const errHandler = err => {
          reject(err)
        }
        // Listen for the 'error' event on our HTTP server.
        this.httpServer.on('error', errHandler)
        this.httpServer.listen(this.config.PORT, this.config.HOST, 20, () => {
          this.manager.startUpdateLoop()
          this.httpServer.off('error', errHandler)
          resolve(true)
        })
      }
    })
  }

  /**
   * Stops this HTTP server. Returns a promise that resolves to a boolean
   * representing whether whether the server close procedures have been initiated.
   * @returns {Promise<boolean>}
   */
  stop () {
    return new Promise((resolve, reject) => {
      if (!this.initialized) {
        reject(
          new Error('CWServer is not initialized!')
        )
      } else
      if (!this.httpServer.listening) {
        // Again, we don't want an error to be thrown if the server is already
        // closed or closing, so that's why we do this check here.
        resolve(false)
      } else {
        this.manager.stopUpdateLoop()
        this.gameServer.stop()
        this.httpServer.close(err => {
          if (err) {
            reject(err)
            return
          }
          resolve(true)
        })
      }
    })
  }

  /**
   * Creates a CWServer object. This is mainly here so the CWServer object
   * could be initialized automatically.
   * @param {string} [confFile] The path of the configuration file.
   * @returns {Promise<CWServer>}
   */
  static async create (confFile) {
    const server = new CWServer(confFile)
    await server.init()
    return server
  }
}

module.exports = exports = CWServer
