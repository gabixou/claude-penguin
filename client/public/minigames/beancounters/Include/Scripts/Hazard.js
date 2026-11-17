var spawnInterval = setInterval(function(){},100000)

// Spawn a hazard every second
function StartHazards() {
	var interval = 1000
	if(truck<3) {
		interval+=200
	}
	else if(truck==5) {
		interval = 600
	}
	spawnInterval = setInterval(function() {
		newHazard()
		
		// Maybe spawn a second one (more likely after first level)
		if(!device.randomNum(0,truck==1?5:2)) {
			setTimeout(newHazard, 395)
		}
	}, interval)
	
	// One hazard immediately
	newHazard()
}

// Create a new hazard
function newHazard() {
	var anvil = {name:"Anvil",chance:[],min:580,max:650}
	var bag = {name:"Bag",chance:[],min:200,max:645}
	var fish = {name:"Fish",chance:[],min:200,max:340}
	var vase = {name:"Vase",chance:[],min:415,max:575}
	var hazards = []
	switch(truck) {
		case 2:
			anvil.chance = [1,2,3,4,5,6,7]
			bag.chance = [8,9,10,11,12,13,14,15,16,17,18,19,20]
			hazards = [anvil,bag]
			break
		case 3:
			anvil.chance = [1,2,3,4,5,6]
			bag.chance = [7,8,9,10,11,12,13,14]
			fish.chance = [15,16,17,18,19,20]
			hazards = [anvil,bag,fish]
			break
		case 4:
		case 5:
			anvil.chance = [1,2,3,4]
			bag.chance = [5,6,7,8,9,10]
			fish.chance = [11,12,13,14,15]
			vase.chance = [16,17,18,19,20]
			hazards = [anvil,bag,fish,vase]
			break
		default:
			bag.chance = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]
			hazards = [bag]
	}
	
	// Get the hazard
	var hazard = false
	var random = device.randomNum(1,21)
	if(random > 20) {
		if(truck == 3 || truck == 5) {
			hazard = {name:"Life",min:300,max:690}
		}
		else {
			random = device.randomNum(1,20)
		}
	}
	$.each(hazards, function(i, h) {
		if(h.chance.includes(random)) {
			hazard = h
		}
	})
	
	if(hazard) {
		var img = hazard.name=="Bag"?"Bag_1":hazard.name
	
		$(".play-area").first().append('<img class="hazard '+hazard.name.toLowerCase()+'" name="'+hazard.name+'" style="bottom: 320px; left: 825px;" src="Assets/Hazards/'+img+'.png">')
		 
		var $h = $(".play-area").first().find(".hazard").last()
		var fall = 4
		var launchTo = device.randomNum(hazard.min,hazard.max)
		if(launchTo > 470) {
			fall = 1
			launchTo += 80
		}
		var maxHeight = device.randomNum(390, 404)
		
		// posicao em JS + transform: css("left","-=x") do jQuery le o
		// computed style (layout sincrono) por chamada; writes de left/
		// bottom tambem invalidam layout. translate() e compositor —
		// zero layout por frame, visual identico.
		var hel = $h[0]
		var hx = parseFloat(getComputedStyle(hel).left) || 0
		var hb = parseFloat(getComputedStyle(hel).bottom) || 0
		var hx0 = hx, hb0 = hb
		// Movimento no relogio fixo de 30fps (app.fixedInterval): a chain
		// original de setTimeout(12) disparava ~83x/s com jitter de
		// wall-clock — o jogo ficava "as vezes acelerado". Os deltas eram
		// calibrados por passo de ~12ms; K converte para passo de 33.3ms
		// preservando a velocidade em px/seg. `fall` (pausa no topo, em
		// ticks de 12ms) vira limiar equivalente: fall*12ms / 33.3ms.
		var K = (1000 / 30) / 12
		var fallT = fall * 12 / (1000 / 30)
		var moveId = 0, alive = true
		var move = function() {
			if(!$h.length || $h.hasClass("broken") || $h.attr("gone")) {
				alive = false
				if(moveId > 0 && app.clearFixedInterval) app.clearFixedInterval(moveId)
				moveId = 0
				return
			}
			if(hx > launchTo) {
				hx -= 10 * K
			}
			else if(launchTo < 470) {
				hx -= 5 * K
			}
			else {
				hx -= 1.85 * K
			}
			var fin = $h.attr("fallin")
			if(hb < maxHeight && !fin) {
				hb += 4.5 * K
			}
			else if(fin) {
				if(fin >= fallT) {
					if(hb <= 70) {
						$h.addClass("broken")
						if(hazard.name != "Life") {
							$h.attr("src", "Assets/Hazards/"+hazard.name+"_Broken.png")
							$h.delay(500).fadeOut("fast", function() {
								$h.remove()
							})
							// Play the land sound
							$("."+(hazard.name.toLowerCase())+"-land").remove()
							$("body").append('<audio autoplay class="'+(hazard.name.toLowerCase())+'-land" src="Assets/Sounds/'+hazard.name+'_Land.mp3"></audio>')
						}
						else {
							$h.fadeOut("fast", function() {
								$h.remove()
							})
						}
					}
					else if(launchTo < 470) {
						hb -= 10 * K
					}
					else {
						hb -= 13.6 * K
					}
				}
				else {
					$h.attr("fallin", parseInt(fin)+1)
				}
			}
			else {
				$h.attr("fallin", 0)
			}
			// um unico write compositor por tick (left+bottom via translate)
			hel.style.transform = "translate("+(hx-hx0)+"px,"+(hb0-hb)+"px)"
		}
		
		// Wait a few ms before launching, depois anda no relogio fixo
		setTimeout(function() {
			if (app.fixedInterval) {
				moveId = app.fixedInterval(move, 1000 / 30)
			}
			else {
				// fallback sem relogio fixo: chain classica de 12ms
				var chain = function() { if (alive) { move(); setTimeout(chain, 12) } }
				chain()
			}
		}, 8)
		
		// If the hazard is a bag, animate it
		if(hazard.name == "Bag") {
			setTimeout(function() {
				$h.attr("src", "Assets/Hazards/Bag_2.png")
				setTimeout(function() {
					$h.attr("src", "Assets/Hazards/Bag_3.png")
				}, 185)
			}, device.isSwitch?315:200)
		}
	}
}

// Collision detection
function collidesWith(element1, element2) {
    // getBoundingClientRect: 2 reads por par — o original chamava
    // .offset()/.width()/.height() 8x por par (layout sincrono cada um)
    var r1 = element1.getBoundingClientRect();
    var r2 = element2.getBoundingClientRect();
    return r1.right > r2.left && r1.left < r2.right && r1.top < r2.bottom && r1.bottom > r2.top;
}