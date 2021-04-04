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
|       >=0.4.0       |        0.4.0        |

## Running the tests
Download this repository somehow, ``cd`` into the project root, and run:
```sh
npm install
npm test
```
(just like any other Node.JS project.)
