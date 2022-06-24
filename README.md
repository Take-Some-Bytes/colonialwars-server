# Colonial Wars Server
This is ``colonialwars-server``, one of the components of Colonial Wars.
This repository includes:
- A ``WS`` server to manage real-time game communications, and
- A ``HTTP`` API server to give game server information to clients.

The front-end application could be found at ``colonialwars-client``. The ``WS`` server
in this application conforms to the Colonial Wars Data Transfer Protocol as defined
[here](
  https://github.com/Take-Some-Bytes/specifications/blob/5542f478975dc45480d631f314837cc571681b0a/colonialwars/pow_cwdtp.md
).

## Compatibility
| colonialwars-server | colonialwars-client |
|:-------------------:|:-------------------:|
|        0.1.0        |          --         |
|    0.2.0 - 0.3.2    |       <=0.2.0       |
|        0.3.2        |        0.3.0        |
|        ^0.4.0       |        ^0.4.0       |
|        ^0.5.0       |        ^0.5.0       |

## Running the tests
Download this repository somehow, ``cd`` into the project root, and run:
```sh
npm install
npm test
```
Make sure you have Node.JS [installed](https://nodejs.org), with a version that satisfies
the [``engines``](https://github.com/Take-Some-Bytes/colonialwars-server/blob/main/package.json#L24)
field (currently Node.JS 12 and up).

## Running the server
When this project is downloaded, there is a script to start the server for development
called ``dev``. It may be accessed like so:
```sh
npm run dev
```
By default, debug logging is turned off. To turn it on, just specify the ``DEBUG`` environment
variable as documented in the [``debug``](https://www.npmjs.com/package/debug#usage) module.

To enable all debug logging, use this:
```sh
DEBUG=colonialwars* npm run dev
```

Additional documentation can be found in the ``docs/`` folder.

Again, make sure Node.JS has been installed before running the server (see above for
requirements).
