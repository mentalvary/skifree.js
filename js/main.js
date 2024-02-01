// Global dependencies which return no modules
require('./lib/canvasRenderingContext2DExtensions');
require('./lib/extenders');
require('./lib/plugins');

// External dependencies
var Hammer = require('hammerjs');
var Mousetrap = require('br-mousetrap');
const {Howl, Howler} = require('howler');

// Method modules
var isMobileDevice = require('./lib/isMobileDevice');

// Game Objects
var SpriteArray = require('./lib/spriteArray');
var Monster = require('./lib/monster');
var Sprite = require('./lib/sprite');
var Snowboarder = require('./lib/snowboarder');
var Skier = require('./lib/skier');
var InfoBox = require('./lib/infoBox');
var Game = require('./lib/game');

// Local variables for starting the game
var splashScreen = document.getElementById('splash');
var startButton = document.getElementById('start-btn');
var mainCanvas = document.getElementById('skifree-canvas');
var dContext = mainCanvas.getContext('2d');
var imageSources = [ 'sprite-characters.png', 'skifree-objects.png' ];
var global = this;
var infoBoxControls = 'Use the mouse or WASD to control the player';
if (isMobileDevice()) infoBoxControls = 'Tap or drag on the piste to control the player';

const sndOhGodTree = new Howl({src : ['ohgodtree.wav']});
const sndAah = new Howl({src : ['aah.wav']});
const sndBat = new Howl({src : ['bat.wav']});
const sndScream = new Howl({src : ['fall_scream.wav']});
const sndElaTime = new Howl({src : ['its_ela_time.wav']});
const sndRoar = new Howl({src : ['roar.wav']});
const sndCry = new Howl({src : ['soycry.wav']});
const sndGBM = new Howl({src : ['gbm.wav']});
const sndKaskelott = new Howl({src : ['kaskelott.wav']});
const sndKart = new Howl({src : ['kart.m4a']});
sndKart.volume(0.1);
sndKart.loop(true);
var sprites = require('./spriteInfo');

var pixelsPerMetre = 18;
var distanceTravelledInMetres = 0;
var monsterDistanceThreshold = 1500;
var monsterSpawnRate = 0.001;
var livesLeft = 5;
var highScore = 0;
var treesHit = 0;
var treesHitHighScore = 0;
var treesHitDone = false;
var startTime = new Date();
var loseLifeOnObstacleHit = false;
var dropRates = {smallTree: 4, tallTree: 2, jump: 1, thickSnow: 1, rock: 1};
if (localStorage.getItem('highScore')) highScore = localStorage.getItem('highScore');
if (localStorage.getItem('treesHitHighScore')) treesHitHighScore = localStorage.getItem('treesHitHighScore');

function loadImages (sources, next) {
	var loaded = 0;
	var images = {};

	function finish () {
		loaded += 1;
		if (loaded === sources.length) {
			next(images);
		}
	}

	sources.each(function (src) {
		var im = new Image();
		im.onload = finish;
		im.src = src;
		dContext.storeLoadedImage(src, im);
	});
}

function monsterHitsSkierBehaviour(monster, skier) {
	sndRoar.playing() || sndRoar.play();
	setTimeout(function() {sndScream.playing() || sndScream.play()}, 1000);
	skier.isEatenBy(monster, function () {
		livesLeft -= 1;
		monster.isFull = true;
		monster.isEating = false;
		skier.isBeingEaten = false;
		monster.setSpeed(skier.getSpeed());
		monster.stopFollowing();
		var randomPositionAbove = dContext.getRandomMapPositionAboveViewport();
		monster.setMapPositionTarget(randomPositionAbove[0], randomPositionAbove[1]);
	});
}

function startNeverEndingGame (images) {
	var player;
	var startSign;
	var infoBox;
	var game;

	function resetGame () {
		distanceTravelledInMetres = 0;
		livesLeft = 5;
		treesHit = 0;
		treesHitDone = false;
		highScore = localStorage.getItem('highScore');
		treesHitHighScore = localStorage.getItem('treesHitHighScore');
		game.reset();
		game.addStaticObject(startSign);
		startTime = new Date();
	}

	function detectEnd () {
		if (!game.isPaused()) {
			highScore = localStorage.setItem('highScore', distanceTravelledInMetres);
			infoBox.setLines([
				'Game over!',
				'Hit space to restart'
			]);
			game.pause();
			game.cycle();
		}
	}

	function randomlySpawnNPC(spawnFunction, dropRate) {
		var rateModifier = Math.max(800 - mainCanvas.width, 0);
		if (Number.random(1000 + rateModifier) <= dropRate) {
			spawnFunction();
		}
	}

	function spawnMonster () {
		var newMonster = new Monster(sprites.monster);
		var randomPosition = dContext.getRandomMapPositionAboveViewport();
		newMonster.setMapPosition(randomPosition[0], randomPosition[1]);
		newMonster.follow(player);
		newMonster.setSpeed(player.getStandardSpeed());
		newMonster.onHitting(player, monsterHitsSkierBehaviour);
		sndGBM.playing() || sndGBM.play()
		setTimeout(function() {sndCry.playing() || sndCry.play()}, 1500);

		game.addMovingObject(newMonster, 'monster');
	}

	function spawnBoarder () {
		var newBoarder = new Snowboarder(sprites.snowboarder);
		var randomPositionAbove = dContext.getRandomMapPositionAboveViewport();
		var randomPositionBelow = dContext.getRandomMapPositionBelowViewport();
		newBoarder.setMapPosition(randomPositionAbove[0], randomPositionAbove[1]);
		newBoarder.setMapPositionTarget(randomPositionBelow[0], randomPositionBelow[1]);
		newBoarder.onHitting(player, sprites.snowboarder.hitBehaviour.skier);

		game.addMovingObject(newBoarder);
	}

	player = new Skier(sprites.skier);
	player.setMapPosition(0, 0);
	player.setMapPositionTarget(0, -10);
	player.setHitObstacleCb(function(obs) {

		if (obs.data.obsType === "tree" || obs.data.obsType === "rock") {
			sndAah.playing() || sndAah.play();
			if (obs.data.obsType === "tree") {
				treesHit++;
			}
		}
		else if (obs.data.obsType === "snowboarder") {
			sndKaskelott.playing() || sndKaskelott.play();
		}
	});
	player.onCloseObstacleCb = function(obs) {
		// console.log(obs.data.obsType);
		if (obs.data.obsType === "tree") {
			sndOhGodTree.playing() || sndOhGodTree.play();
		}
	}
	const _hasHitJump = player.hasHitJump
	player.hasHitJump = function() {
		sndBat.playing() || sndBat.play();
		_hasHitJump();
	}
	// if ( loseLifeOnObstacleHit ) {
	// 	player.setHitObstacleCb(function() {
	// 		livesLeft -= 1;
	// 	});
	// }

	game = new Game(mainCanvas, player);

	startSign = new Sprite(sprites.signStart);
	game.addStaticObject(startSign);
	startSign.setMapPosition(-50, 0);
	dContext.followSprite(player);

	infoBox = new InfoBox({
		initialLines : [
			'SkiFree.js (Ela edition)',
			infoBoxControls,
			'Travelled 0m',
			'High Score: ' + highScore,
			'@highlightTrees hit: ' + treesHit,
			'@highlightMost trees hit in 1 min: ' + treesHitHighScore,
			'Skiers left: ' + livesLeft,
			'Original created by Dan Hough (@basicallydan)',
			'Made worse by mentalvary'
		],
		position: {
			top: 15,
			right: 10
		}
	});

	game.beforeCycle(function () {
		var newObjects = [];
		if (player.isMoving) {
			newObjects = Sprite.createObjects([
				{ sprite: sprites.smallTree, dropRate: dropRates.smallTree },
				{ sprite: sprites.tallTree, dropRate: dropRates.tallTree },
				{ sprite: sprites.jump, dropRate: dropRates.jump },
				{ sprite: sprites.thickSnow, dropRate: dropRates.thickSnow },
				{ sprite: sprites.rock, dropRate: dropRates.rock },
			], {
				rateModifier: Math.max(800 - mainCanvas.width, 0),
				position: function () {
					return dContext.getRandomMapPositionBelowViewport();
				},
				player: player
			});
		}
		if (!game.isPaused()) {
			game.addStaticObjects(newObjects);

			randomlySpawnNPC(spawnBoarder, 0.1);
			distanceTravelledInMetres = parseFloat(player.getPixelsTravelledDownMountain() / pixelsPerMetre).toFixed(1);

			if (distanceTravelledInMetres > monsterDistanceThreshold) {
				randomlySpawnNPC(spawnMonster, monsterSpawnRate);
			}

			const elapsed = new Date() - startTime;
			let remaining = elapsed;
			const elmin = Math.floor(remaining / 60000);
			remaining -= elmin * 60000
			const elsec = Math.floor(remaining / 1000);
			const elms = remaining - elsec * 1000;

			if (elapsed >= 30000 && !treesHitDone && treesHit > treesHitHighScore) {
				treesHitDone = true;
				treesHitHighScore = treesHit
				localStorage.setItem('treesHitHighScore', treesHitHighScore);
			}

			infoBox.setLines([
				'SkiFree.js (Ela edition)',
				infoBoxControls,
				'Travelled ' + distanceTravelledInMetres + 'm',
				'Skiers left: ' + livesLeft,
				'High Score: ' + highScore,
				'@highlightTime: ' + `${elmin}:${String(elsec).padStart(2, '0')}.${String(elms).padStart(3, '0')}`,
				'@highlightTrees hit: ' + treesHit,
				'@highlightMost trees hit in 30s: ' + treesHitHighScore,
				'Original created by Dan Hough (@basicallydan)',
				'Made worse by mentalvary',
				'Current Speed: ' + player.getSpeed()/*,
				'Skier Map Position: ' + player.mapPosition[0].toFixed(1) + ', ' + player.mapPosition[1].toFixed(1),
				'Mouse Map Position: ' + mouseMapPosition[0].toFixed(1) + ', ' + mouseMapPosition[1].toFixed(1)*/
			]);
		}
	});

	game.afterCycle(function() {
		if (livesLeft === 0) {
			detectEnd();
		}
	});

	game.addUIElement(infoBox);
	
	$(mainCanvas)
	.mousemove(function (e) {
		game.setMouseX(e.pageX);
		game.setMouseY(e.pageY);
		player.resetDirection();
		player.startMovingIfPossible();
	})
	.bind('click', function (e) {
		game.setMouseX(e.pageX);
		game.setMouseY(e.pageY);
		player.resetDirection();
		player.startMovingIfPossible();
	})
	.focus(); // So we can listen to events immediately

	Mousetrap.bind('f', player.speedBoost);
	Mousetrap.bind('t', player.attemptTrick);
	Mousetrap.bind(['w', 'up'], function () {
		player.stop();
	});
	Mousetrap.bind(['a', 'left'], function () {
		if (player.direction === 270) {
			player.stepWest();
		} else {
			player.turnWest();
		}
	});
	Mousetrap.bind(['s', 'down'], function () {
		player.setDirection(180);
		player.startMovingIfPossible();
	});
	Mousetrap.bind(['d', 'right'], function () {
		if (player.direction === 90) {
			player.stepEast();
		} else {
			player.turnEast();
		}
	});
	Mousetrap.bind('m', spawnMonster);
	Mousetrap.bind('b', spawnBoarder);
	Mousetrap.bind('space', resetGame);

	var hammertime = Hammer(mainCanvas).on('press', function (e) {
		e.preventDefault();
		game.setMouseX(e.gesture.center.x);
		game.setMouseY(e.gesture.center.y);
	}).on('tap', function (e) {
		game.setMouseX(e.gesture.center.x);
		game.setMouseY(e.gesture.center.y);
	}).on('pan', function (e) {
		game.setMouseX(e.gesture.center.x);
		game.setMouseY(e.gesture.center.y);
		player.resetDirection();
		player.startMovingIfPossible();
	}).on('doubletap', function (e) {
		player.speedBoost();
	});

	player.isMoving = false;
	player.setDirection(270);

	_start = game.start;
	game.start = function() {
		sndElaTime.playing() || sndElaTime.play();
		sndKart.playing() && sndKart.stop();
		setTimeout(function() {
			sndKart.stop();
			sndKart.play();
		}, 5000);
		
		_start();
	};

	game.start();
}


function resizeCanvas() {
	mainCanvas.width = window.innerWidth;
	mainCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas, false);

resizeCanvas();

function start() {
	splashScreen.remove();
	loadImages(imageSources, startNeverEndingGame);
}

startButton.onclick = start;

this.exports = window;
