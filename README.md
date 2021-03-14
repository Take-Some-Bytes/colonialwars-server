# Colonial Wars Server
This is ``colonialwars-server``, one of the components of Colonial Wars.
This repository includes:
- A ``Socket.IO`` server to manage real-time game communications, and
- A ``HTTP`` API server to give game server information to clients.

The front-end application could be found at ``colonialwars-client``.

## Compatibility
| colonialwars-server | colonialwars-client |
|:-------------------:|:-------------------:|
|        0.1.0        |          --         |
|    0.2.0 - 0.3.2    |       <=0.2.0       |
|        0.3.2        |        0.3.0        |
|       >=0.4.0       |        0.4.0        |

## Running the tests
Download this repository somehow, ``cd`` into the project root, and run:
```sh
npm install
npm test
```
(just like any other Node.JS project.)
