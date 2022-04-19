# Colonial Wars Server Changelog
Changelog for ``colonialwars-server``.

The format is based on [Keep a Changelog][1], and this project adheres to [Semantic Versioning][2].

## [Unreleased]
### Changed:
- Changed the call signature of the ``.sendAndLogError()`` method on the ``ErrorSender`` class.

## [v0.5.3] - 2022-04-17
### Added:
- Added specs for the ``ErrorHandlers`` class, the ``Vector2D`` class, the ``GameServer`` class,
and CWDTP utility functions.
### Changed:
- Reorganized specs - everything is now in its own folder.
- Updated [``ws``](https://www.npmjs.com/package/ws) to 8.x release line. This a major
dependency update.
- Updated [``jasmine``](https://www.npmjs.com/package/jasmine) to 4.x release line. This a major
dependency update.
- Don't check for error number (``err.errno``) because of unreliability.
### Fixed:
- Fixed WSConn specs to use ``ws://`` URLs instead of ``http://`` URLs.
- Fixed an unknown error with the ``bufferUtils.concatBuffers()`` function - if it was called, an
error was just thrown.
- Fixed an unknown error with the ``crypto.hash()`` function - if the data passed in was an
[``ArrayBuffer``](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer),
an error was thrown because ``hash.update`` does not take array buffers.
### Removed:
- Removed the ``ServerUtils`` class and its specs.

## [v0.5.2] - 2021-08-24
### Changed:
- Log a message when a request tries to GET a non-existent route instead of just silently sending
a 404.
### Fixed:
- Fixed links in this changelog.

## [v0.5.1] - 2021-06-06
### Added:
- Added [``accepts``](https://www.npmjs.com/package/accepts) to parse the ``Accept`` header,
instead of trying to parse it ourselves.
- Added [``morgan``](https://www.npmjs.com/package/morgan) for request logging.
- Added a new ``ErrorSender`` class that sends errors to clients. Compared with the ``ServerUtils``
class, the ``ErrorSender`` class only has one responsibility, doesn't force you to specify
everything, and is more explicit in what methods do what.
### Changed:
- Changed logging architecture. Transports for loggers are now more flexible (and configurable),
support for formatting (via ``winston.format.splat``) has been added, and JSON logging is supported.
- Removed code that directly registered handler on a router in the ``Controllers`` class. All route
handlers are just returned, and the caller has the register them explicitly.
### Fixed:
- Fixed the fact that, sometimes, a WSConn would refuse to close.
  * **THE REASON**: When a handshake timeout occurs, a WSConn would try to forcefully disconnect.
  But due to the implementation of the ``disconnect`` function, it doesn't work. So, the WSConn stayed
  open indefinitely.
  * **THE SOLUTION**: We separated the ``disconnect`` function into two new ones: the new ``disconnect``
  function only handles graceful disconnects, and the new ``terminate`` function handles forceful
  disconnects.
- Fixed the fact that a WSConn will not emit a ``disconnect`` event if the transport layer (the
WebSocket connection) was closed.
- Fixed application shutdown handlers. They will now register a 10-second timeout--if the application
has still not exited gracefully after ten seconds, the application is going to be shut down forcefully
using ``process.exit(1)``.
- Fixed the spec helper ``fetch``. It now rejects correctly when the request faces an error.
### Deprecated:
- The ``ServerUtils`` class is now deprecated. New code should use the ``ErrorSender`` class.
### Removed:
- Removed the ``/testing`` route.

## [v0.5.0] - 2021-04-29
### Added:
- Added a ``TimedStore`` class, which deletes items after the specified amount of time.
- Added [``lru-cache``](https://www.npmjs.com/package/lru-cache),
which ``TimedStore`` depends on.
- Added a 6 second idle timeout for all connections made to this server. This is to prevent
the process from indefinitely hanging when we want to shut down, and it's nice for DDOS prevention
too (....probably not).
- Added a new ``GameServer`` class, which handles game updates, admissions, player input,
authorization, and the WebSocket server. This completes the connection between the game
client and game server.
- Added a ``/game-auth`` route, which clients can use to obtain authorization to enter a game.
- Added player tracking in the ``Manager`` class: it now tracks all the player's names across
all the games that ``Manager`` is managing. Subsequently, it could be used to ensure that no more
than one instance of player ``Bob`` exists on a single game server.
- Added new game configurations; now, you need to specify the game's map's theme.
### Changed:
- Renamed the ``GameServer`` class to the ``CWServer`` class, as ``CWServer`` is a more appropriate
name for what the class does.
- Moved all the stuff in ``lib/websockets`` to ``lib/cwdtp``.
- Decreased updates per second from 25/s to 10/s.
- Increased player speed from 0.4 to 0.9.
- Updated the ``WSConn`` class to conform to [CWDTP Revision 6][4].
### Removed:
- Removed logic which decided whether to log an error while parsing the ``Forwarded`` header.
Now, if an error is encountered, the header is ignored, and the next middleware is called.
- Removed all references to [``Socket.IO``](https://socket.io). We never used it in this project,
and with our current plans, we never will.

## [v0.4.3] - 2021-04-03
### Added:
- Added [``nanoid``](https://www.npmjs.com/package/nanoid) for generating WebSocket connection IDs.
- Added a ``crypto`` module to provide a unified API for Node.JS and the browser. That way, we won't
have to rewrite a lot of crypto code when we use the ``WSConn`` class in the front end.
### Changed:
- ``WSServer`` and ``WSConn`` are now fully-fledged implementations of [``CWDTP``][3], instead of
a "slight" wrapper around WebSockets.

## [v0.4.2] - 2021-03-25
### Added:
- Added a replacement for ``valley.json`` called ``plains.json``.
- Added a map description field in all map save files.
- Added some wrapper classes and utility functions to make working with ``ws`` easier.
### Changed:
- Used [``ws``](https://www.npmjs.com/package/ws) instead of Socket.IO.
- Updated the ``/game-stats`` route to send a game description.
### Removed:
- Removed ``valley.json``.

## [v0.4.1] - 2021-03-13
### Changed:
- Updated NPM lock file version.
- Updated code to work with updated map save file structures in [``specifications/colonialwars/file-structures.md``](
  https://github.com/Take-Some-Bytes/specifications/blob/6505648b28a5f8b12edfaaf2d1df603ef48debc6/colonialwars/file-structures.md
). Most notably, the way teams are specified have been changed. The old syntax for specifying
teams is still supported for compatibility reasons, 
- Updated a lot of logging in and around the game server.
### Fixed:
- Actually uploaded ``.gitignore`` to GitHub.
- Actually uploaded updated compatibility data for ``README.md`` to GitHub.
- Fixed specs for the ``Controllers`` class. The specs were still expecting the old response format,
and now they (correctly) expect the new response format.
- Fixed the links that point to the [``specifications``](https://github.com/Take-Some-Bytes/specifications)
repository. Now, they point to specific commit hashes, which is always better since the client sees
the specifications as they were at that time, instead of the latest specifications.

## [v0.4.0] - 2021-03-12
### Added:
- Added a ``.gitignore`` file so we can actually start using ``Git`` properly.
### Changed:
- Changed all game configuration files to conform to the save file structures
defined in [``specifications/colonialwars/file-structures.md``](
  https://github.com/Take-Some-Bytes/specifications/blob/8b485d772503bcc0fce802a3407b5f54a655666c/colonialwars/file-structures.md
).
- Changed player input handling. Instead of applying player velocity changes
on input, the input is pushed to a queue with a timestamp, and processed
every time the player is updated.
- Updated all game-related classes to work with the updated save file structures.
- Updated all HTTP responses to conform to the structure defined in
[``specifications/colonialwars/message-structures.md``](
  https://github.com/Take-Some-Bytes/specifications/blob/main/colonialwars/message-structure.md#http-response-body-structure
).
- Updated ``serverUtils.sendError()`` method to accept custom content types.
- Update compatibility data in ``README.md``.
### Fixed:
- Fixed the fact that no response gets sent when a CORS error is encountered.

## [v0.3.2] - 2021-02-11
### Added:
- Added ``GameLoader`` specs.
- Added a way to track clients in the ``Manager`` class.
- Added a route that returns statistics about the games running on the GameServer.
- Added a ``game/data`` folder to store game-related data, e.g. map save files
and unit data files.
### Changed:
- Started using the ``Manager`` and ``GameLoader`` classes in our backend.
- Updated compatibility data.
### Fixed:
- Fixed the fact that the ``bound-object.js`` file was ***not renamed*** to ``bound-entity.js``
in the GitHub repository.
- Fixed the fact that all the dates in this CHANGELOG were wrong since
2020-12-30.

## [v0.3.1] - 2021-01-23
### Added:
- Added a ``GameLoader`` class to load games from configuration files.
- Added a ``Manager`` class to manage the amount of games that are running on this server.
- Added compatibility data in ``README.md``.
- Added an NPM ``check`` script that runs ``npm audit``, ``npm outdated``, and ``npm test``.
### Changed:
- Renamed the ``BoundObject`` class to the ``BoundEntity`` class.
- Updated the ``BaseGame`` class to inherit from the ``events.EventEmitter`` class.
- Updated some game-related files to take required parameters inside a ``config`` object instead
of passing them one by one.
- Updated the ``fetch`` function in ``fetch.js`` to use ``http.request`` instead of ``http.get``.
### Fixed:
- Fixed the ``RegExp`` used to check if the ``Accept`` header has the correct values. Before,
users could enter values like ``application/plain``, and it will pass. Now, ``application/plain``
will not pass.
- Fixed the ``deepFreeze`` method; before, if there was a ``NO_FREEZE`` symbol on the passed-in object's
properties, the entire function would exit.

## [v0.3.0] - 2021-01-14
### Added:
- Added utility functions to mess around with math in ``/lib/utils/math-utils.js``.
- Added many game-related files:
  * ``player.js``, to manage the player logic;
  * ``base-game.js``, a base class with all the methods and properties common
  to all game modes;
  * ``bound-object.js``, a class representing an object that is bound to a minimum and maximum; and
  * ``vector-2d.js``, a class representing a 2D vector.
### Changed:
- Changed spec naming convention--instead of using ``[name]_spec.js``, now we use ``[name].spec.js``.
- Changed all occurances of the [EM dash](https://www.thesaurus.com/e/grammar/em-dash/) to use two
hypens instead. Why? I've decided I don't want to use obscure characters in my programs, since they could
cause all sorts of problems... (An EM dash is not a valid ASCII character).
### Removed:
- Removed a lot of ``console.log``s in the specs.

## [v0.2.0] - 2021-01-05
### Added:
- Added [``cors``](https://www.npmjs.com/package/cors) package to manage CORS in this application.
- Added CORS support within the application since some client-side JavaScript is going to
make requests to these servers from different domains.
- Added a class (``ErrorHandlers``) to house application error handlers.
### Removed:
- Removed the ``.handleOptions()`` method on the ``Middlewares`` class. The OPTIONS method is now
handled by the ``cors`` NPM package.
- Removed tests for ``middlewares.handleOptions()``.

## [v0.1.0] - 2020-12-30
- Initial (pre-)release.

[1]: https://keepachangelog.com/
[2]: https://semver.org
[3]: https://github.com/Take-Some-Bytes/specifications/blob/5542f478975dc45480d631f314837cc571681b0a/colonialwars/pow_cwdtp.md
[4]: https://github.com/Take-Some-Bytes/specifications/blob/d8013611e60ce71d845b7d7d7d9570a05f11ca34/colonialwars/pow_cwdtp.md

[v0.1.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/4faa6df4e70ab7239b6d7edf29d22feb026657f3
[v0.2.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/db96ffa372e8791d2a1cdbf47d4b69550b0cb3d4
[v0.3.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/b4038be257524ea868baaf4cdd04893918946f8e
[v0.3.1]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/f1323f4de881d09549b9f965f7b853ebe7277c32
[v0.3.2]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/1c66e82c53ae1c64810d7068f8642ebfca1062b3
[v0.4.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/ca6c60753f6ab621059641cb8e5a79eda8acf5c4
[v0.4.1]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/cd8bb1506754564979add0c67c86d1f108a9e8a8
[v0.4.2]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/c375b8c0f2226ac94e514404dda1191fa76b8a3a
[v0.4.3]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/f083df5d5f546e2ffb261e61a38e86fc2fab4c08
[v0.5.0]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/e3ff32918ba199298fb2aa8121534fe4fd8807ff
[v0.5.1]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/428a5256378b4bc0574a2d3e92d81336e3501a69
[v0.5.2]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/09c4902bc57c53bf1904975a27bd59e216164dc9
[v0.5.3]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/567c80dfe3cd51f8b84be748ba5368029857b1af
[Unreleased]: https://github.com/Take-Some-Bytes/colonialwars-server/tree/main
