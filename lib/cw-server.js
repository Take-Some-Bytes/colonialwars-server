/* eslint-env node */
/**
 * @fileoverview CWServer class.
 */

const http = require('http')
const debug = require('debug')('colonialwars:cwserver')
const Router = require('router')
const winstonConfig = require('winston/lib/winston/config')

const errors = require('./errors')
const utils = require('./utils/utils')
const constants = require('./constants')
const Manager = require('./game/manager')
const GameServer = require('./game-server')
const TimedStore = require('./timed-store')
const Loggers = require('./logging/loggers')
const GameLoader = require('./game/gameloader')
const ServerUtils = require('./utils/server-utils')
const Controllers = require('./controllers/controllers')
const Middlewares = require('./controllers/middlewares')
const Configurations = require('./utils/configurations')
const ErrorHandlers = require('./controllers/errorhandlers')

/**
 * CWServer class.
 */
class CWServer {
  /**
   * Constructor for a CWServer class.
   * @param {string} [confFile] The path to the configuration file.
   */
  constructor (confFile) {
    this.confFile = confFile || ''

    /**
     * @type {InstanceType<Configurations>}
     */
    this.config = {}
    this.initialized = false
  }

  /**
   * Gets self configurations.
   * @private
   */
  async _getConfig () {
    const fileConfig = await Configurations.readFrom(
      // Enter constants.FALLBACKS here so it won't throw an error if the
      // file is not found or something.
      this.confFile, constants.FALLBACKS
    )
    this.config = Configurations.from(
      constants.FALLBACKS,
      fileConfig.config,
      // process.env takes precedence.
      utils.filterEnv(process.env)
    )
    // Set the NODE_ENV.
    process.env.NODE_ENV = this.config.get('IS_PROD')
      ? 'production'
      : 'development'
    debug('Got configuration file.')

    const originsArr = this.config.get('ALLOWED_ORIGINS')
    /**
     * @type {Array<string>}
     */
    this.allowedOrigins = /\[.*\]/.test(originsArr)
      ? typeof originsArr === 'string'
          ? JSON.parse(originsArr)
          : originsArr
      : [
          'http://0.0.0.0:5555',
          'http://localhost:5555',
          'http://colonialwars.localhost:5555'
        ]
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
      let loggerTransports = this.config.get('LOGGING_TRANSPORTS', info.id)
      if (!loggerTransports) {
        loggerTransports = [{ type: 'console', config: { level: 'debug' } }]
      }

      this.loggers.addLogger({
        id: info.id,
        label: info.label,
        useReadableFormat: !this.config.get('IS_PROD'),
        transports: loggerTransports
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
      full: this.manager.numClients >= this.config.get('MAX_CLIENTS'),
      capacity: {
        maxClients: this.config.get('MAX_CLIENTS'),
        currentClients: this.manager.numClients
      }
    }
  }

  /**
   * Initializes common helper classes.
   * @private
   */
  _initCommonHelpers () {
    this.serverUtils = new ServerUtils({
      loggers: this.loggers,
      debug: debug
    })
    debug('Initialized server utilities.')
    this.authStore = new TimedStore({
      maxItems: this.config.get('AUTH_STORE_CONFIG', 'MAX_ENTRIES'),
      maxAge: this.config.get('AUTH_STORE_CONFIG', 'MAX_ENTRY_AGE'),
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
    this.gameloader = new GameLoader({
      debug: debug,
      loggers: this.loggers,
      maxConfSize: this.config.get('MAX_CONF_SIZE'),
      baseDir: this.config.get('GAME_CONF_BASE_DIR'),
      gameConstants: this.config.get('GAME_CONSTANTS')
    })
    debug('Initialized game loader.')
    this.manager = await Manager.create({
      loggers: this.loggers,
      gameLoader: this.gameloader,
      maxGames: this.config.get('MAX_GAMES'),
      gameConfs: this.config.get('GAME_CONFS'),
      startGames: this.config.get('STARTING_GAME_NUM'),
      updateLoopFrequency: this.config.get('UPDATE_LOOP_FREQUENCY')
    })
    debug('Initialized game manager.')
  }

  /**
   * Initializes API application helper classes.
   * @private
   */
  _initAppHelpers () {
    this.middlewares = new Middlewares({
      serverUtils: this.serverUtils,
      URL_MAX_LEN: 150,
      debug: debug,
      corsOpts: {
        origin: (origin, cb) => {
          if (this.allowedOrigins.includes(origin) || !origin) {
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
      isProd: this.config.get('IS_PROD'),
      gameAuthSecret: this.config.get('GAME_AUTH_SECRET'),
      authDB: this.authStore,
      serverUtils: this.serverUtils,
      loggers: this.loggers
    })
    debug('Initialized application controllers.')
    this.errorHandlers = new ErrorHandlers({
      loggers: this.loggers,
      serverUtils: this.serverUtils
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
      this.middlewares.cookieParser(this.config.get('COOKIE_SECRET')),
      this.middlewares.queryParser(),
      this.middlewares.forwardedParser(),
      this.middlewares.setCSPHeader(),
      this.middlewares.getClientIP({
        behindProxy: this.config.get('IS_PROD'),
        trustedIPs: this.config.get('TRUSTED_PROXY_IPS')
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
    await this._getConfig()
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
      socket.setTimeout(this.config.get('SERVER_CONN_TIMEOUT'))
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
      allowedOrigins: this.allowedOrigins,
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
        // No need for function arguments--server listen configurations
        // are extracted from our `config` object.
        this.httpServer.listen(this.config.get('PORT'), this.config.get('HOST'), 20, () => {
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
