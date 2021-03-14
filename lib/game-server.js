/* eslint-env node */
/**
 * @fileoverview GameServer class.
 */

const http = require('http')
const debug = require('debug')
const Router = require('router')
const winstonConfig = require('winston/lib/winston/config')

const errors = require('./errors')
const utils = require('./utils/utils')
const constants = require('./constants')
const Manager = require('./game/manager')
const Loggers = require('./logging/loggers')
const GameLoader = require('./game/gameloader')
const ServerUtils = require('./utils/server-utils')
const Controllers = require('./controllers/controllers')
const Middlewares = require('./controllers/middlewares')
const Configurations = require('./utils/configurations')
const ErrorHandlers = require('./controllers/errorhandlers')

/**
 * GameServer class.
 */
class GameServer {
  /**
   * Constructor for a GameServer class.
   * @param {string} [confFile] The path to the configuration file.
   */
  constructor (confFile) {
    this.debug = debug('colonialwars-server')
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
    this.debug('Got configuration file.')

    const originsArr = this.config.get('ALLOWED_ORIGINS')
    /**
     * @type {Array<string>}
     */
    this.allowedOrigins = /\[.*\]/.test(originsArr)
      ? typeof originsArr === 'string'
          ? JSON.parse(originsArr)
          : originsArr
      : ['http://0.0.0.0:5555', 'http://localhost:5555']
  }

  /**
   * Gets logging configurations.
   * @private
   */
  _getLoggersConfig () {
    const conf = {
      isProd: false,
      debug: this.debug,
      loggerInfos: [
        { id: 'Server-logger', label: 'Server_log' },
        { id: 'Security-logger', label: 'Security_log' },
        { id: 'Game-logger', label: 'Game_log' }
      ],
      levels: winstonConfig.syslog.levels,
      colors: winstonConfig.syslog.colors,
      syslogOpts: null
    }
    this.loggersConf = {
      dev: conf,
      prod: Object.assign(
        Object.assign({}, conf), {
          isProd: true,
          syslogOpts: this.config.get('SYSLOG_OPTS')
        }
      )
    }

    this.debug('Got logging configurations.')
  }

  /**
   * Gets the status of this game server.
   * @returns {Controllers.GameServerStatus}
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
   * Initializes helper classes for game managing.
   * @private
   */
  async _initGameHelpers () {
    this.gameloader = new GameLoader({
      debug: this.debug,
      loggers: this.loggers,
      maxConfSize: this.config.get('MAX_CONF_SIZE'),
      baseDir: this.config.get('GAME_CONF_BASE_DIR'),
      gameConstants: this.config.get('GAME_CONSTANTS')
    })
    this.debug('Initialized game loader.')
    this.manager = await Manager.create({
      loggers: this.loggers,
      gameLoader: this.gameloader,
      maxGames: this.config.get('MAX_GAMES'),
      gameConfs: this.config.get('GAME_CONFS'),
      startGames: this.config.get('STARTING_GAME_NUM'),
      updateLoopFrequency: this.config.get('UPDATE_LOOP_FREQUENCY')
    })
    this.debug('Initialized game manager.')
  }

  /**
   * Initializes common helper classes.
   * @private
   */
  _initCommonHelpers () {
    this.loggers = new Loggers(
      this.config.get('IS_PROD')
        ? this.loggersConf.prod
        : this.loggersConf.dev
    )
    this.debug('Initialized application loggers.')
    this.serverUtils = new ServerUtils({
      loggers: this.loggers,
      debug: this.debug
    })
    this.debug('Initialized server utilities.')
  }

  /**
   * Initializes API application helper classes.
   * @private
   */
  _initAppHelpers () {
    this.middlewares = new Middlewares({
      serverUtils: this.serverUtils,
      URL_MAX_LEN: 150,
      debug: this.debug,
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
        ]
      }
    })
    this.debug('Initialized application middlewares.')
    this.controllers = new Controllers({
      isProd: this.config.get('IS_PROD'),
      serverUtils: this.serverUtils
    })
    this.debug('Initialized application controllers.')
    this.errorHandlers = new ErrorHandlers({
      serverUtils: this.serverUtils
    })
    this.debug('Initialized application error handlers.')
  }

  /**
   * Initializes this GameServer's API server.
   * @private
   */
  _initApp () {
    this.router = new Router()
    // First, log the request.
    this.router.use(
      this.middlewares.logRequest()
    )
    // Second, CORS checkpoint.
    this.router.use(
      this.middlewares.corsCheckpoint()
    )
    this.router.options('*', this.middlewares.corsCheckpoint())
    // Third, parsing middleware.
    this.router.use(
      this.middlewares.cookieParser(this.config.get('COOKIE_SECRET')),
      this.middlewares.forwardedParser()
    )
    // Next, HTTP security middleware.
    this.router.use(
      this.middlewares.setCSPHeader()
    )
    // Last, custom application middleware.
    this.router.use(
      this.middlewares.getClientIP({
        behindProxy: this.config.get('IS_PROD'),
        trustedIPs: this.config.get('TRUSTED_PROXY_IPS')
      }),
      this.middlewares.sysCheckpoint(constants.APP_OPTS.IMPLEMENTED_METHODS),
      this.middlewares.acceptCheckpoint()
    )
    // Now, the controllers
    this.controllers.registerTestRoute(this.router)
    this.controllers.registerStatusRoute(this.router, {
      getStatus: this._getStatus.bind(this)
    })
    this.controllers.registerGamesStatsRoute(this.router, this.manager)
    // Here, we need to handle all other unhandled routes.
    this.controllers.handleUnhandled(this.router)
    // Lastly, we need to register all the error controllers.
    this.router.use(this.errorHandlers.handleCorsError())
  }

  /**
   * Initializes this GameServer.
   */
  async init () {
    await this._getConfig()
    this._getLoggersConfig()
    this._initCommonHelpers()
    this._initAppHelpers()
    await this._initGameHelpers()
    this._initApp()

    this.server = http.createServer((req, res) => {
      this.router(req, res, err => {
        // In theory nothing should hit this function... but if it does,
        // we should handle it.
        if (err) {
          this.loggers.get('Server-logger').error(
            `Error while serving ${req.url}! Error is: ${err.stack}`
          )
        }
      })
    })

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
        const err = new Error('GameServer is not initialized!')
        err.code = 'ENOTINITIALIZED'

        reject(err)
      } else if (this.server.listening) {
        // We don't want an error to be thrown if the server is already listening,
        // so that's why we do this check here.
        resolve(false)
      } else {
        // Listen for the 'error' event on our HTTP server.
        this.server.on('error', err => {
          reject(err)
        })
        // No need for function arguments--server listen configurations
        // are extracted from our `config` object.
        this.server.listen(
          this.config.get('PORT'), this.config.get('HOST'),
          20, () => {
            resolve(true)
          }
        )
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
          new Error('GameServer is not initialized!')
        )
      } else
      if (!this.server.listening) {
        // Again, we don't want an error to be thrown if the server is already
        // closed or closing, so that's why we do this check here.
        resolve(false)
      } else {
        this.server.close(err => {
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
   * Creates a GameServer object. This is mainly here so the GameServer object
   * could be initialized automatically.
   * @param {string} [confFile] The path of the configuration file.
   * @returns {Promise<GameServer>}
   */
  static async create (confFile) {
    const server = new GameServer(confFile)
    await server.init()
    return server
  }
}

module.exports = exports = GameServer
