String.prototype.clr = function (hexColor) { return `<font color="#${hexColor}">${this}</font>` };
const Vec3 = require('tera-vec3');

const mapID = [9782, 9982];
const HuntingZn = [782, 982];
const BossID = [1000, 2000, 3000];

const config = require('./config.json');
const FirstBossActions = {
	106: {msg: 'Heavy'},
	107: {msg: 'Pushback'},
	109: {msg: 'Rocks (Small)'},
	110: {msg: 'Rocks (Large)'},
	301: {msg: 'Flower stuns'},
	309: {msg: '1 flower'},
	310: {msg: '2 flowers'},
	116: {msg: 'Big AoE attack!!'},
	312: {msg: 'Golden flower!!'}
};
const SecondBossActions = {
	105: {msg: 'Spin'},
	113: {msg: 'Stun'},
	114: {msg: 'Get IN'},
	116: {msg: 'Front then Back'},
	301: {msg: '↓ Get OUT + dodge'},
	302: {msg: '↑ Get IN + dodge'}
};
const ThirdBossActions = {
	118: {msg: 'Front triple'}, // aka Tank Buster
	143: {msg: '←← Left rear ←←'},
	145: {msg: '←← Left rear ←←'},
	146: {msg: '←← Left rear ←← (pulses)', sign_degrees: 330, sign_distance: 320},
	154: {msg: '←← Left rear ←← (pulses)', sign_degrees: 330, sign_distance: 320},
	144: {msg: '→→ Right rear →→'},
	147: {msg: '→→ Right rear →→'},
	148: {msg: '→→ Right rear →→ (pulses)', sign_degrees: 30, sign_distance: 320},
	155: {msg: '→→ Right rear →→ (pulses)', sign_degrees: 30, sign_distance: 320},
	
	139: {msg: 'Left safe', sign_degrees: 270, sign_distance: 200}, //151 //clockwise (swinging head) king hitting right
	150: {msg: 'Left safe!', sign_degrees: 270, sign_distance: 200}, //151 //clockwise (landing) king hit right
	141: {msg: 'Right safe', sign_degrees: 90, sign_distance: 200}, //153 //Counterclockwise (swinging head) King hit left
	152: {msg: 'Right safe!', sign_degrees: 90, sign_distance: 200}, //153 //Counterclockwise (landing) King hit left
	
	161: {msg: 'Back then Front'},
	162: {msg: 'Back then Front'},
	213: {msg: 'Tail'},
	215: {msg: 'Tail!!'},
	
	300: {msg: 'Dodge!!'}, // Awakening 1
	360: {msg: 'Explosion!!'},
	399: {msg: 'Awakening 2'}
};

module.exports = function ccGuide(d) {
	let	enabled = config.enabled,
		sendToParty = config.sendToParty,
		streamenabled = config.streamenabled,
		msgcolour = config.msgcolour,

		isTank = false,
		insidemap = false,
		insidezone = false,
		whichmode = 0,
		whichboss = 0,
		hooks = [], bossCurLocation, bossCurAngle, uid0 = 999999999, uid1 = 899999999, uid2 = 799999999, notice = true, power = false, Level = 0, powerMsg = '';

	d.command.add('ddinfo', (arg) => {
		d.command.message('enabled: ' + `${enabled}`.clr('00FFFF'));
		d.command.message('insidemap: ' + insidemap);
		d.command.message('insidezone: ' + insidezone);
		d.command.message('whichmode: ' + whichmode);
		d.command.message('whichboss: ' + whichboss);
		d.command.message('sendToParty ' + (sendToParty ? 'true'.clr('56B4E9') : 'false'.clr('E69F00')));
		d.command.message('isTank ' + (isTank ? 'true'.clr('00FFFF') : 'false'.clr('FF0000')));
		sendMessage('test');
	})
	d.command.add('gls', (arg) => {
		if (!arg) {
			enabled = !enabled;
			d.command.message('enabled: ' + (enabled ? 'true'.clr('56B4E9') : 'false'.clr('E69F00')));
		} else {
			switch (arg) {
				case "party":
					sendToParty = !sendToParty;
					d.command.message('sendToParty ' + (sendToParty ? 'true'.clr('56B4E9') : 'false'.clr('E69F00')));
					break;
				case "proxy":
					streamenabled = !streamenabled;
					d.command.message('streamenabled ' + (streamenabled ? 'true'.clr('56B4E9') : 'false'.clr('E69F00')));
					break;
				default :
					d.command.message('Invalid argument!'.clr('FF0000'));
					break;
			}
		}
	});

	d.hook('S_LOGIN', 10, sLogin)
	d.hook('S_LOAD_TOPO', 3, sLoadTopo);

	function sLogin(event) {
		let job = (event.templateId - 10101) % 100;
		if (job === 1 || job === 10) {
			isTank = true;
		} else {
			isTank = false;
		}
	}

	function sLoadTopo(event) {
		if (event.zone === mapID[0]) {								
			insidemap = true;
			d.command.message('Welcome to ' + 'Grotto of Lost Souls '.clr('56B4E9') + '[NM]'.clr('E69F00'));
			load();
		} else if (event.zone === mapID[1]) {
			insidemap = true;
			d.command.message('Welcome to ' + 'Grotto of Lost Souls '.clr('56B4E9') + '[HM]'.clr('00FFFF'));
			load();
		} else {
			unload();
		}
    }

	function load() {
		if (!hooks.length) {
			hook('S_BOSS_GAGE_INFO', 3, sBossGageInfo);
			hook('S_ACTION_STAGE', 8, sActionStage);
			hook('S_DUNGEON_EVENT_MESSAGE', 2,sDungeonEventMessage);

			function sBossGageInfo(event) {
				if (!insidemap) return;

				let bosshp = (event.curHp / event.maxHp);

				if (bosshp <= 0) {
					whichboss = 0;
				}

				if (event.curHp == event.maxHp) {
					notice = true,
					power = false,
					Level = 0,
					powerMsg = '';
				}

				if (event.huntingZoneId == HuntingZn[0]) {
					insidezone = true;
					whichmode = 1;
				} else if (event.huntingZoneId == HuntingZn[1]) {
					insidezone = true;
					whichmode = 2;
				} else {
					insidezone = false;
					whichmode = 0;
				}

				if (event.templateId == BossID[0]) whichboss = 1;
				else if (event.templateId == BossID[1]) whichboss = 2;
				else if (event.templateId == BossID[2]) whichboss = 3;
				else whichboss = 0;
			}

			function sActionStage(event) {
				if (!enabled || !insidezone || whichboss==0) return;
				if (event.templateId!=BossID[0] && event.templateId!=BossID[1] && event.templateId!=BossID[2]) return;
				let skillid = event.skill.id % 1000;
				bossCurLocation = event.loc;
				bossCurAngle = event.w;

				if (whichboss==1 && FirstBossActions[skillid]) {
					if (!isTank && skillid === 106) return;
					if ( isTank && skillid === 107) return;
					sendMessage(FirstBossActions[skillid].msg);
				}

				if (whichboss==2 && SecondBossActions[skillid]) {
					sendMessage(SecondBossActions[skillid].msg);
					// 2王 内外圈
					if (skillid === 114 || skillid === 301 || skillid === 302) {
						Spawnitem(603, 20, 260);
						Spawnitem(603, 40, 260);
						Spawnitem(603, 60, 260);
						Spawnitem(603, 80, 260);
						Spawnitem(603, 100, 260);
						Spawnitem(603, 120, 260);
						Spawnitem(603, 140, 260);
						Spawnitem(603, 160, 260);
						Spawnitem(603, 180, 260);
						Spawnitem(603, 200, 260);
						Spawnitem(603, 220, 260);
						Spawnitem(603, 240, 260);
						Spawnitem(603, 260, 260);
						Spawnitem(603, 280, 260);
						Spawnitem(603, 300, 260);
						Spawnitem(603, 320, 260);
						Spawnitem(603, 340, 260);
						Spawnitem(603, 360, 260);
					}
					// 2王 前砸后砸 横向对称轴
					if (skillid === 116) {
						Spawnitem(603, 90, 25);
						Spawnitem(603, 90, 50);
						Spawnitem(603, 90, 75);
						Spawnitem(603, 90, 100);
						Spawnitem(603, 90, 125);
						Spawnitem(603, 90, 150);
						Spawnitem(603, 90, 175);
						Spawnitem(603, 90, 200);
						Spawnitem(603, 90, 225);
						Spawnitem(603, 90, 250);
						Spawnitem(603, 90, 275);
						Spawnitem(603, 90, 300);
						Spawnitem(603, 90, 325);
						Spawnitem(603, 90, 350);
						Spawnitem(603, 90, 375);
						Spawnitem(603, 90, 400);
						Spawnitem(603, 90, 425);
						Spawnitem(603, 90, 450);
						Spawnitem(603, 90, 475);
						Spawnitem(603, 90, 500);

						Spawnitem(603, 270, 25);
						Spawnitem(603, 270, 50);
						Spawnitem(603, 270, 75);
						Spawnitem(603, 270, 100);
						Spawnitem(603, 270, 125);
						Spawnitem(603, 270, 150);
						Spawnitem(603, 270, 175);
						Spawnitem(603, 270, 200);
						Spawnitem(603, 270, 225);
						Spawnitem(603, 270, 250);
						Spawnitem(603, 270, 275);
						Spawnitem(603, 270, 300);
						Spawnitem(603, 270, 325);
						Spawnitem(603, 270, 350);
						Spawnitem(603, 270, 375);
						Spawnitem(603, 270, 400);
						Spawnitem(603, 270, 425);
						Spawnitem(603, 270, 450);
						Spawnitem(603, 270, 475);
						Spawnitem(603, 270, 500);
					}
				}

				if (whichboss==3 && ThirdBossActions[skillid]) {
					// 屏蔽重复通知的技能
					if (!notice) return;
					if (notice && (skillid===118||skillid===139||skillid===150||skillid===141||skillid===152)) {
						notice = false;
						setTimeout(function() { notice = true }, 4000);
					}
					// 蓄电层数计数
					if (whichmode==2) {
						// 一次觉醒 开始充能计数
						if (skillid===300) power = true, Level = 0, powerMsg = '';
						// 放电爆炸 重置充能计数
						if (skillid===360) Level = 0;
						// 二次觉醒 开始充能计数
						if (skillid===399) Level = 0;
					}
					if (power && (
						skillid===118||

						skillid===213||
						skillid===215||

						skillid===143||
						skillid===145||

						skillid===146||
						skillid===154||

						skillid===144||
						skillid===147||

						skillid===148||
						skillid===155||

						skillid===161||
						skillid===162)
					) {
						Level++;
						//powerMsg = '<font color="#FF0000">(' + Level + ') </font> ';
						powerMsg = '{' + Level + '} ';
					}

					// 3王 左右扩散初始位置标记
					if (skillid === 146 || skillid === 154 || skillid === 148 || skillid === 155) {
						SpawnThing(ThirdBossActions[skillid].sign_degrees, ThirdBossActions[skillid].sign_distance, 8000);
					}

					// 3王 飞天半屏攻击
					if (skillid === 139 || skillid === 150 || skillid === 141 || skillid === 152) {
						// 垂直对称轴
						Spawnitem(603, 0, 25);
						Spawnitem(603, 0, 50);
						Spawnitem(603, 0, 75);
						Spawnitem(603, 0, 100);
						Spawnitem(603, 0, 125);
						Spawnitem(603, 0, 150);
						Spawnitem(603, 0, 175);
						Spawnitem(603, 0, 200);
						Spawnitem(603, 0, 225);
						Spawnitem(603, 0, 250);
						Spawnitem(603, 0, 275);
						Spawnitem(603, 0, 300);
						Spawnitem(603, 0, 325);
						Spawnitem(603, 0, 350);
						Spawnitem(603, 0, 375);
						Spawnitem(603, 0, 400);
						Spawnitem(603, 0, 425);
						Spawnitem(603, 0, 450);
						Spawnitem(603, 0, 475);
						Spawnitem(603, 0, 500);

						Spawnitem(603, 180, 25);
						Spawnitem(603, 180, 50);
						Spawnitem(603, 180, 75);
						Spawnitem(603, 180, 100);
						Spawnitem(603, 180, 125);
						Spawnitem(603, 180, 150);
						Spawnitem(603, 180, 175);
						Spawnitem(603, 180, 200);
						Spawnitem(603, 180, 225);
						Spawnitem(603, 180, 250);
						Spawnitem(603, 180, 275);
						Spawnitem(603, 180, 300);
						Spawnitem(603, 180, 325);
						Spawnitem(603, 180, 350);
						Spawnitem(603, 180, 375);
						Spawnitem(603, 180, 400);
						Spawnitem(603, 180, 425);
						Spawnitem(603, 180, 450);
						Spawnitem(603, 180, 475);
						Spawnitem(603, 180, 500);
						// 光柱+告示牌
						SpawnThing(ThirdBossActions[skillid].sign_degrees, ThirdBossActions[skillid].sign_distance, 5000);
					}

					sendMessage(powerMsg + ThirdBossActions[skillid].msg);
				}
			}

			function sDungeonEventMessage(event) {
				if (!enabled || !insidezone || whichboss==0) return;
				let sDungeonEventMessage = parseInt(event.message.replace('@dungeon:', ''));
				if (whichboss==3) {
					if (sDungeonEventMessage === 0000000) {
						sendMessage('!!');
					}
				}
			}
		}
	}

	function hook() {
		hooks.push(d.hook(...arguments));
	}

	function unload() {
		if (hooks.length) {
			for (let h of hooks)
				d.unhook(h);
			hooks = [];
		}
		reset();
	}

	function reset() {
		insidemap = false,
		insidezone = false,
		whichmode = 0,
		whichboss = 0,
		notice = true,
		power = false,
		Level = 0,
		powerMsg = '';
	}

	function sendMessage(msg) {
		if (msgcolour) {
			msg = `${msg}`.clr(msgcolour);
		}

		if (sendToParty) {
			d.toServer('C_CHAT', 1, {
				channel: 21, //21 = p-notice, 1 = party, 2 = guild
				message: msg
			});
		} else if (streamenabled) {
			d.command.message(msg);
		} else {
			d.toClient('S_CHAT', 2, {
				channel: 21, //21 = p-notice, 1 = party
				authorName: 'DG-Guide',
				message: msg
			});
		}
	}
	//地面提示(花朵)
	function Spawnitem(item, degrees, radius) { //显示物品 偏移角度 半径距离
		if (streamenabled) return;
		let r = null, rads = null, finalrad = null, spawnx = null, spawny = null, pos = null;

		r = bossCurAngle - Math.PI;
		rads = (degrees * Math.PI/180);
		finalrad = r - rads;
		spawnx = bossCurLocation.x + radius * Math.cos(finalrad);
		spawny = bossCurLocation.y + radius * Math.sin(finalrad);
		pos = {x:spawnx, y:spawny};
		// 花朵
		d.toClient('S_SPAWN_COLLECTION', 4, {
			gameId : uid0,
			id : item,
			amount : 1,
			loc : new Vec3(pos.x, pos.y, bossCurLocation.z),
			w : r,
			unk1 : 0,
			unk2 : 0
		});
		// 延时消除
		setTimeout(Despawn, 5000, uid0)
		uid0--;
	}
	// 消除花朵
	function Despawn(uid_arg0) {
		d.toClient('S_DESPAWN_COLLECTION', 2, {
			gameId : uid_arg0
		});
	}
	// 地面提示(光柱+告示牌)
	function SpawnThing(degrees, radius, times) { //偏移角度 半径距离 持续时间
		if (streamenabled) return;
		let r = null, rads = null, finalrad = null, pos = null;

		r = bossCurAngle - Math.PI;
		rads = (degrees * Math.PI/180);
		finalrad = r - rads;
		bossCurLocation.x = bossCurLocation.x + radius * Math.cos(finalrad);
		bossCurLocation.y = bossCurLocation.y + radius * Math.sin(finalrad);
		// 告示牌
		d.toClient('S_SPAWN_BUILD_OBJECT', 2, {
			gameId : uid1,
			itemId : 1,
			loc : bossCurLocation,
			w : r,
			unk : 0,
			ownerName : 'prompt',
			message : 'Prompt area'
		});

		bossCurLocation.z = bossCurLocation.z - 100;
		// 龙头光柱
		d.toClient('S_SPAWN_DROPITEM', 6, {
			gameId: uid2,
			loc: bossCurLocation,
			item: 98260,
			amount: 1,
			expiry: 6000,
			owners: [{playerId: uid2}]
		});
		// 延迟消除
		setTimeout(DespawnThing, times, uid1, uid2);
		uid1--;
		uid2--;
	}
	// 消除 光柱+告示牌
	function DespawnThing(uid_arg1, uid_arg2) {
		d.toClient('S_DESPAWN_BUILD_OBJECT', 2, {
			gameId : uid_arg1,
			unk : 0
		});
		d.toClient('S_DESPAWN_DROPITEM', 4, {
			gameId: uid_arg2
		});
	}

}
