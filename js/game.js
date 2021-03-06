(function() {
  var WIDTH = 256,
    HEIGHT = 144,
    SCALE = 3,
    HORIZON = 56,
    running = false,
    kb = new KeyboardControls(),
    buffer, boardCanvas, context, outCtx,
    dialogue,
    board,
    viewX = 0,
    viewY = 0,
    sheet, chars,
    dude,
    x, y;

  var gameEl = document.querySelector('#game');
  gameEl.style.width = SCALE * WIDTH + 'px';
  gameEl.style.height = SCALE * HEIGHT + 'px';

  var requestFrame = (function() {
    return window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      function(callback) {
        setTimeout(callback, 30);
      };
  })();

  var lastTrigger = 0;
  var leftTrigger = true;
  var dialogueCoolDown = 0;
  var seenOpening = window.location.hash === '#skip';

  function tick() {
    if (!running) return;

    var ox = x;
    var oy = y;
    var tick = (new Date()).getTime();
    var d = 1;
    var walk = 0;
    var dir = 0;
    var view = board.getView();

    dude.walk(0);

    if (kb.keys[kb.LEFT]) {
      dude.face(1);
      dude.walk(1);
      if (board.test(x + 3 - d, y + 8) && board.test(x + 3 - d, y + 15)) {
        x -= d;
      }
    }
    if (kb.keys[kb.RIGHT]) {
      dude.face(3);
      dude.walk(1);
      if (board.test(x + 12 + d, y + 8) && board.test(x + 12 + d, y + 15)) {
        x += d;
      }
    }
    if (kb.keys[kb.DOWN]) {
      dude.face(0);
      dude.walk(1);
      if (board.test(x + 3, y + 15 + d) && board.test(x + 12, y + 15 + d)) {
        y += d;
      }
    }
    if (kb.keys[kb.UP]) {
      dude.face(2);
      dude.walk(1);
      if (board.test(x + 3, y + 8 - d) && board.test(x + 12, y + 8 - d)) {
        y -= d;
      }
    }

    // This is a hack so some interiors and dungeons don't pan.
    if (x < 192 * 16) {
      if (x > board.viewX() + WIDTH - HORIZON - 16) {
        board.pan(d, 0);
      }
      if (y > board.viewY() + HEIGHT - HORIZON - 16) {
        board.pan(0, d);
      }
      if (x < board.viewX() + HORIZON) {
        board.pan(-d, 0);
      }
      if (y < board.viewY() + HORIZON) {
        board.pan(0, -d);
      }
    }

    board.update();

    if (dialogueCoolDown > 0) {
      dialogueCoolDown--;
    }

    var trigger = board.getTrigger(x + 3, y + 8, 9, 7);

    // Troll Encounters!
    if (22 * 16 <= x && x <= 43 * 16 && 0 <= y && y <= 22 * 16) {
      if (Math.random() > .995) {
        trigger = {
          "auto": true,
          "dialogue": "TROLL",
          "encounter": true,
          "destination": 8690,
          "center": 8178
        };
      }
    }

    if (!seenOpening) {
      stop();
      dialogue.chat('OPENING', function () {
        seenOpening = true;
        start();
      });
    }

    if (trigger) {
      maybeEncounter(trigger, function () {
        if (trigger.destination && (trigger !== lastTrigger || leftTrigger) && leftTrigger) {
          board.centerTo(trigger.center);
          var pos = board.toCoords(trigger.destination);
          x = pos.x;
          y = pos.y;
          render();
        }
        if (trigger.dialogue && trigger.dialogue !== 'NOOP') {
          if (trigger.entity && !trigger.auto) {
            trigger.entity.prompt = true;
          }
          if (trigger.auto || (kb.keys[kb.SPACE] && dialogueCoolDown === 0)) {
            stop();
            dialogue.chat(trigger.dialogue, function (change) {
              dialogueCoolDown = 20;
              if (trigger.entity) {
                trigger.entity.prompt = null;
              }
              if (change === 'GAMEOVER') {
                stop();
                setTimeout(titleScreen, 0);
                return;
              } else if (change === 'FLEE') {
                x = 39 * 16;
                y = 30 * 16;
                dude.face(0);
                board.centerTo(7719);
              } else if (change) {
                trigger.dialogue = change;
              }
              start();
            });
          }
        }
        lastTrigger = trigger;
        leftTrigger = false;
      });
    }
    if (!trigger) {
      leftTrigger = true;
      if (lastTrigger && lastTrigger.entity) {
        lastTrigger.entity.prompt = null;
      }
    }

    lastTick = tick;
  }


  function maybeEncounter(trigger, callback) {
    if (trigger.encounter) {
      stop();
      var y = -8;
      outCtx.fillStyle = '#000';
      function bar() {
        outCtx.fillRect(0, y * SCALE, WIDTH * SCALE, 4 * SCALE);
        outCtx.fillRect(0, (HEIGHT - 4 - y) * SCALE, WIDTH * SCALE, 4 * SCALE);
        y += 8;
        if (y < HEIGHT) {
          setTimeout(bar, 50);
        } else {
          render();
          callback();
        }
      }
      bar();
    } else {
      callback();
    }
  }

  function mapRect(map, px, py, s, w, h) {
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        map[(x + px) + (y + py) * 256] = (s + x + y * 20);
      }
    }
  }

  var startTime;
  var tickCount = 0;
  var isPaused = false;
  function start() {
    if (running) return;
    running = true;
    tickCount = 0;
    startTime = Date.now();
    loop();
  }

  function loop() {
    if (document.hidden) {
      pause();
      return;
    }
    var time = Date.now();
    var tickGoal = (time - startTime) / 10;
    while (tickCount < tickGoal) {
      tick();
      tickCount++;
    }
    render();
    if (running) {
      requestFrame(loop, canvas);
    }
  }

  function pause() {
    console.log('pause');
    stop();
    isPaused = true;
    function poll() {
      if (document.hidden) {
        setTimeout(poll, 100);
      } else {
        console.log('unpause');
        isPaused = false;
        start();
      }
    }
    poll();
  }

  function stop() {
    running = false;
  }

  function render() {
    board.render();
    context.fillRect(0,0,WIDTH*SCALE,HEIGHT*SCALE);
    context.drawImage(board.getBGCanvas(), 0, 0);
    var view = board.getView();
    dude.render(context, x - view.x, y - view.y);
    context.drawImage(board.getFGCanvas(), 0, 0);
    outCtx.drawImage(buffer, 0, 0);
  }

  function setup() {
    buffer = document.createElement('canvas');
    buffer.width = WIDTH * SCALE;
    buffer.height = HEIGHT * SCALE;

    canvas = document.createElement('canvas');
    canvas.width = WIDTH * SCALE;
    canvas.height = HEIGHT * SCALE;
    outCtx = canvas.getContext('2d');

    context = buffer.getContext('2d');
    context.mozImageSmoothingEnabled = false;
    context.scale(SCALE, SCALE);

    gameEl.appendChild(canvas);
  }

  function startGame() {
    x = 47 * 16;
    y = 50 * 16;



    sheet = new SpriteSheet(Loader.get('tiles'), 16);
    chars = new SpriteSheet(Loader.get('characters'), 16);
    dude = new Dude(chars, 0);

    dialogue = new Dialogue(Loader.get('dialogue'), WIDTH, HEIGHT);

    var map = Loader.get('map');

    board = new Screen(map, 16, WIDTH, HEIGHT, sheet);
    board.centerTo(x / 16, y / 16);

    Loader.get('entities').forEach(function (e) {
      if (e.sheet === 'tiles') {
        board.addEntity(new Entity(sheet, e));
      } else {
        board.addEntity(new Entity(chars, e));
      }
    });


    start();
  }

  function wait(ms) {
    return function () {
      return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms);
      });
    };
  }

  var progressEl = document.querySelector('.progress-inner');
  function loadProgress(a, b) {
    var pct = a / b * 100;
    progressEl.style.width = pct + '%';
  }

  function titleScreen() {
    var splashEl = document.querySelector('.splash');
    splashEl.style.display = 'block';
    splashEl.classList.add('ready');
    return new Promise(function (resolve, reject) {
      function handle(e) {
        if (e.keyCode === kb.SPACE) {
          window.removeEventListener('keydown', handle, false);
          splashEl.classList.add('crazy');
          resolve();
        }
      }
      window.addEventListener('keydown', handle, false);
    }).then(wait(500)).then(function () {
      splashEl.style.display = 'none';
      splashEl.classList.remove('crazy');
    }).then(startGame).catch(console.error.bind(console));
  }

  if (window.location.search === '?debug') {
    window.DEBUG = true;
  }

  window.addEventListener('load', function() {
    var loading = Loader.load([
      {
        name: 'tiles',
        type: 'image',
        url: 'img/tilesheet.png'
      },
      {
        name: 'characters',
        type: 'image',
        url: 'img/characters.png'
      },
      {
        name: 'map',
        type: 'json',
        url: 'map.json'
      },
      {
        name: 'dialogue',
        type: 'dlg',
        url: 'tree.dlg'
      },
      {
        name: 'entities',
        type: 'json',
        url: 'entities.json'
      }
    ], loadProgress);

    wait(1000)().then(loading).then(setup).then(titleScreen).catch(console.error.bind(console));
  });
})();
