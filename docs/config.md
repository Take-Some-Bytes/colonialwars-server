# Colonial Wars Server Configuration
How to configure Colonial Wars Server.

## Configuration Mechanics
Configuration of Colonial Wars Server is done through
[environment variables](https://en.wikipedia.org/wiki/Environment_variable). Configuration
can either be applied to the process directly (e.g. on the command line):

```sh
$ DEBUG=colonialwars* INSTANCE_NUM=1 node ./bin/bin.js
```

Or in a ``.env`` file which exists in the current working directory.

See the [``dotenv``](https://www.npmjs.com/package/dotenv) package for more details on how
environment variables are loaded from ``.env`` files. Extra processing may occur for options
which require them (i.e. ``ALLOWED_ORIGINS`` will be parsed as a JSON array).

## Configuration Options

### ``ALLOWED_ORIGINS``
Specify the allowed CORS origins.

This configuration is parsed as a JSON array, and the default is a single-element array:

```none
ALLOWED_ORIGINS='["http://localhost:5555"]'
```

### ``LOGGING_TRANSPORTS``
Define the [``winston``](https://www.npmjs.com/package/winston) logging transports to utilize.

This configuration is parsed as a JSON array of objects, and it is applied to *all* loggers.
The structure of each element is as follows:

```jsonc
{
  "type": "<transport type>",
  "config": {
    // ...transport options
  }
}
```

Where ``type`` is equivalent to the lowercased name of the winston transport you want to use,
and ``config`` contains the configuration options for that specific winston transport. Available
transports are:
- [``console``](https://github.com/winstonjs/winston/blob/master/docs/transports.md#console-transport):
Write to the console. By default a console transport is used for all loggers and levels.
- [``file``](https://github.com/winstonjs/winston/blob/master/docs/transports.md#file-transport):
Write to an arbitrary file.
- [``http``](https://github.com/winstonjs/winston/blob/master/docs/transports.md#http-transport):
Write to an HTTP endpoint (e.g. [``winstond``](https://github.com/winstonjs/winstond))
- [``syslog``](https://github.com/winstonjs/winston-syslog): Write to a
[syslog](https://en.wikipedia.org/wiki/Syslog) server.

### ``TRUSTED_IPS``
An array of IPs to trust.

This is mainly useful if there is an upstream proxy; specifying the IP of the proxy allows the
application to determine and *trust* some useful headers, such as the ``X-Forwarded*`` headers
and the [``Forwarded``](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Forwarded)
header.

This configuration is parsed as a JSON array of strings. For example:

```none
TRUSTED_IPS='["127.0.0.1", "192.168.0.1"]'
```

### ``IS_PROD``
Whether to run the server in a production environment or not.

This can be specified in two ways: either directly, by setting ``IS_PROD`` as a boolean
(i.e. either ``true`` or ``false``), or indirectly by setting the ``NODE_ENV`` environment
variable. If the ``NODE_ENV`` environment variable is set to ``production``, the ``IS_PROD``
variable will be set to ``true``; otherwise, it will be set to ``false``.

### ``PORT``
The port to listen on.

Default is 4000.

### ``HOST``
The hostname to listen on.

This can be anything that
[``server.listen``](https://nodejs.org/docs/latest-v12.x/api/net.html#net_server_listen)
accepts.

Default is ``localhost``.

### ``SERVER_CONN_TIMEOUT``
The maximum amount of time (in milliseconds) to idle before terminating a socket.

In other words, the ``SERVER_CONN_TIMEOUT`` configuration specifies how long each connection
can stay alive without IO activity.

Default is 6000 milliseconds (i.e. 6 seconds).

### ``MAX_CLIENTS``
The maximum amount of clients allowed to connect to this server.

Default is 120.

### ``MAX_GAMES``
The maximum amount of games allowed to be running concurrently on this server.

Default is 3.

### ``PLAYER_SPEED``
***DEPRECATED***: The speed of the player when in a game.

Leave this as the default; a new option to configure player speed will appear in map save
files sometime in the near future.

Default is 0.9.

### ``STARTING_GAME_NUM``
The games to run upon server startup.

If all games are full and the current number of games is still below ``MAX_GAMES``, the
server will automatically spawn more (when it's implemented).

Default is 3.

### ``UPDATE_LOOP_FREQUENCY``
How many times per second to run game updates.

Default is 10 per second

### ``GAME_CONF_BASE_DIR``
The directory where all game-related configuration files are stored.

**NOTE**: Map save files should not be in subfolders. The expected structure of this
directory is subject to change.

Default is ``lib/game/data``

### ``GAME_CONFS``
A list of all game configurations (i.e. map save files)

Default is everything inside ``lib/game/data``.

### ``GAME_AUTH_SECRET``
The string used to sign game authorizations.

*Never* leave this as the default in production.

Default is ``11dev-game-auth-secret$$``.

### ``AUTH_STORE_MAX_ENTRIES``
The maximum amount of pending authorizations to allow.

Currently, this option is a no-op.

Default is 10000.

### ``AUTH_STORE_MAX_ENTRY_AGE``
The amount of time (in milliseconds) to keep pending authorizations in the store.

Once the max entry age is reached, expired entries will automatically be dropped.

Default is 6000 milliseconds (i.e. 6 seconds).
