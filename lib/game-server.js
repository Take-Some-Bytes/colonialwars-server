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
const Loggers = require('./logging/loggers')
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
      this.confFile, constants.FALLBACKS
    )
    this.config = Configurations.from(
      fileConfig.config,
      // process.env takes precedence
      utils.filterEnv(process.env)
    )
    // Set the NODE_ENV so that Express behaves correctly.
    process.env.NODE_ENV = this.config.get('IS_PROD')
      ? 'production'
      : 'development'
    this.debug('Got configuration file.')

    const originsArr = this.config.get('ALLOWED_ORIGINS')
    /**
     * @type {Array<string>}
     */
    this.allowedOrigins = /\[.*\]/.test(originsArr)
      ? JSON.parse(originsArr)
      : ['http://localhost:5555']
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
        {
          id: 'Server-logger',
          label: 'Server_log'
        },
        {
          id: 'Security-logger',
          label: 'Security_log'
        }
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
   * Initializes helper classes.
   */
  _initHelpers () {
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
        exposedHeaders: ['Connection', 'Date', 'Vary']
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
      getStatus () {
        return {
          running: true,
          full: false,
          capacity: {
            maxClients: 10,
            currentClients: 0
          }
        }
      }
    })
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
    this._initHelpers()
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

    this.initialized = true
  }

  /**
   * Starts this HTTP server. Returns a promise that resolves to a boolean
   * representing whether whether the server listen procedures have been initiated.
   * @returns {Promise<boolean>}
   */
  async start () {
    return new Promise((resolve, reject) => {
      if (!this.initialized) {
        this.loggers.get('Server-logger').error(
          'Server has not been initialized!'
        )
        reject(
          new Error('GameServer is not initialized!')
        )
      } else if (this.server.listening) {
        // We don't want an error to be thrown if the server is already listening,
        // so that's why we do this check here.
        this.loggers.get('Server-logger').warning(
          'Server is already listening!'
        )
        resolve(false)
      } else {
        // No need for function arguments–server listen configurations
        // are extracted from our `config` object.
        this.server.listen(
          this.config.get('PORT'), this.config.get('HOST'),
          20, err => {
            if (err) {
              this.loggers.get('Server-logger').crit(
                `Error while starting server! Error is: ${err.stack}`
              )
              reject(err)
              return
            }
            this.loggers.get('Server-logger').info(
              `Server started at http://${this.config.get('HOST')}:${this.config.get('PORT')}`
            )
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
