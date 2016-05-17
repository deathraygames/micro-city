RocketBoots.loadComponents([
	"state_machine",
	"Dice",
	"Loop",
	"Incrementer",
	"Building"
]).ready(function(rb){

	window.g = new rb.Game({
		name: "Micro City",
		instantiateComponents: [
			//{"state": "StateMachine"},
			{"loop": "Loop"},
			{"dice": "Dice"},
			{"inc": "Incrementer"}
		]
		/*,
		"stages": [{
			"id": "game-stage",
			"size": {"x": WORLD_X, "y": WORLD_Y}
		}],
		"world": {
			"dimensions": 2,
			//"trackTime": true,
			"isBounded": true,
			"size": {"x": WORLD_X, "y": WORLD_Y}
		}
		*/
	});

//===== Constants

	var MIN_DEMAND = -100,
		MAX_DEMAND = 100,
		BASE_THRESHOLD = 50,
		COLORS = [
			[40,40,50], 	[40,40,50], 	[40,40,50], 	[50,50,60], // midnight - 3am
			[50,50,60], 	[90,80,80], 	[80,80,100], 	[70,80,150], // 4am - 7am
			[50,170,250], 	[50,170,250], 	[50,170,250], 	[50,170,250], // 8am - 11am
			[70,180,255], 	[70,180,255], 	[51,170,255], 	[51,170,255], // Noon - 3pm
			[50,150,200], 	[60,100,200], 	[70,80,200], 	[70,60,150], // 4pm - 7pm
			[70,60,100], 	[70,50,80], 	[60,50,70], 	[50,50,60] 	// 8pm - 11pm
		],
		MAX_BUILDINGS = 100,
		MAX_FLOORS_PER_BUILDING = 10,
		MAX_FLOORS = MAX_BUILDINGS * MAX_FLOORS_PER_BUILDING,
		HEIGHT_PER_FLOOR = 10,
		MAX_HEIGHT = HEIGHT_PER_FLOOR * MAX_FLOORS_PER_BUILDING,
		SOFT_MAX_PLOTS = 66; /* based on each building taking up 1.5% of the width */

	var $skyline = $('#skyline');
	var $buildingsList = $skyline.find('.buildings');
	var residentsPerBuilding = 10;
	var jobsPerCommercialBuilding = 5;
	var jobsPerIndustrialBuilding = 10;
	var servicesPerCommercialBuilding = 5;

	// http://unicode-table.com/en/#1687
	var currencySymbols = ["$", "&#5827;", "&#5099;"];
	var currencySymbol = "&#5099;";

//===== Game Loop and States

	g.loop.set(function(){
		g.inc.incrementByElapsedTime(undefined, true);
	}, 300);
	// Do some things once per second
	g.loop.addModulusAction(1, function(){
		calcBuildingFloorCounts();
		g.inc.calculate(g.buildingModifiers);
		// Adjust hour and day
		if (g.inc.currencies.hour.val >= 24) {
			g.inc.currencies.hour.val = 0;
			g.inc.currencies.day.add(1);
		}
		
		// Build?
		buildRandomType();
		g.draw();
	});

	g.state.addStates({
		"watch": {
			viewName: "interface",
			start: function(){
				g.loop.start();
			},
			end: function(){
				g.loop.stop();
			}
		},
		"pause": {

		}
	});

//===== Draw functions

	g.draw = function draw () {
		if (g.drawCityOn) {
			var html = '';
			$skyline.css({"background": getSkyColor(g.inc.currencies.hour.val)});

			rb._.each(g.buildings, function(building){
				var height = (HEIGHT_PER_FLOOR * building.floors);
				html += (
					'<li><div class="building building-' + building.type 
						+ '" style="height:' + height + 'px;">'
							+ '<div>' + building.name + ' (' + building.type + ')</div>'
					+ '</div></li>'
				);
			});
			$buildingsList.html(html).css({height: (HEIGHT_PER_FLOOR * (g.highestFloorCount + 2))});
		} else {
			$buildingsList.html('').css({height: 0});
			$skyline.css({"background": ""});
		}
		$('.upgrades li').each(function(i, elt){
			var $li = $(elt);
			var tk = $li.data("templatekey");
			var building = getNewBuilding(tk);
			$li.find('.cost').html(getNewPublicBuildingCost(building));
		});
	}

	function getSkyColor (hour) {
		//var percent = hour / 24;
		var color = COLORS[Math.floor(hour)];
		return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
	}

//=====

	function calcBuildingFloorCounts () {
		var currencyKey;
		var currencyProp;
		g.floorCounts = {R: 0, C: 0, I: 0, P: 0};
		g.buildingCounts = {R: 0, C: 0, I: 0, P: 0};
		g.buildingModifiers = {};
		g.highestFloorCount = 0;
		// Loop over all buildings
		rb._.each(g.buildings, function(building){
			g.floorCounts[building.type] += building.floors;
			g.buildingCounts[building.type] += 1;
			if (building.floors > g.highestFloorCount) {
				g.highestFloorCount = building.floors;
			}
			// Loop through all currency modifiers
			if (typeof building.currencyModifiers === 'object') {
				for (currencyKey in building.currencyModifiers) {
					if (typeof g.buildingModifiers[currencyKey] === 'undefined') {
						g.buildingModifiers[currencyKey] = {};
					}
					for (currencyProp in building.currencyModifiers[currencyKey]) {
						if (typeof g.buildingModifiers[currencyKey][currencyProp] === 'undefined') {
							g.buildingModifiers[currencyKey][currencyProp] = 0;
						}
						g.buildingModifiers[currencyKey][currencyProp] += (building.currencyModifiers[currencyKey][currencyProp] * building.floors);
					}
				}
			}
		});
		g.floorCounts.total = g.floorCounts.R + g.floorCounts.C + g.floorCounts.I + g.floorCounts.P;
		g.buildingCounts.total = g.buildingCounts.R + g.buildingCounts.C + g.buildingCounts.I + g.buildingCounts.P;
		return g.floorCounts;
	}

	function buildRandomType () {
		var randomType = g.dice.selectRandom(["R","C","I"]);
		return buildBuildingIfDemanded(randomType);
	}

	function buildBuildingIfDemanded (type) {
		var c = g.inc.currencies;
		if (g.buildings.length >= MAX_BUILDINGS) {
			return false;
		} else if (c["demand" + type].val > g.thresholds[type]) {
			buildBuildingByType(type);
			return true;
		}
		return false;
	}

	function fixDemand (type) {
		g.currencies["demand" + type].subtract(g.thresholds[type]);
		g.thresholds[type] = getNewThreshold();		
	}

	function buildBuildingByType (type) {
		var templateKey = RocketBoots.Building.prototype.getDefaultTemplateKeyByType(type);
		return buildNewBuilding(templateKey);
	}

	function buildNewBuilding (templateKey) {
		var building = getNewBuilding(templateKey);
		var existingBuilding = findBuildingByTemplateKey(building.templateKey);
		var existingBuildingHasFloorSpace = (existingBuilding) ? existingBuilding.hasFloorSpace(1) : false;
		var roll = g.dice.roll1d(100);
		var isFloor = false;
		var chanceOfNewBuilding = ((SOFT_MAX_PLOTS - g.buildings.length)/SOFT_MAX_PLOTS) * 100;
		chanceOfNewBuilding = Math.min(95, Math.max(5, chanceOfNewBuilding));
		isFloor = existingBuildingHasFloorSpace && roll > chanceOfNewBuilding;
		//console.log(templateKey, "chanceOfNewBuilding", chanceOfNewBuilding, roll, existingBuildingHasFloorSpace, isFloor);
		if (isFloor) {
			console.log("Constructing new FLOOR", existingBuilding.name);
			existingBuilding.addFloor(1);
		} else {
			console.log("Constructing new BUILDING", building.name);
			g.buildings.push(building);
		}
		fixDemand(building.type);
		return building;
	}

	function getNewBuilding (templateKey) {
		var options = {
			templateKey: templateKey,
			maxFloors: MAX_FLOORS
		};
		var building = new RocketBoots.Building(options);
		return building;	
	}

	function findBuildingByTemplateKey (tk) {
		var foundBuildings = [];
		rb._.each(g.buildings, function(building){
			if (building.templateKey == tk) {
				foundBuildings.push(building);
			}
		});
		if (foundBuildings.length > 0) {
			return g.dice.selectRandom(foundBuildings);
		} 
		return false;
	}

	function getNewThreshold () {
		return BASE_THRESHOLD + g.dice.roll1d(50) - 1;
	}

	function buyBuilding (tk) {
		var building = getNewBuilding(tk);
		var cost = getNewPublicBuildingCost(building);
		console.log(building, cost)
		if (g.currencies.funds.val >= cost) {
			g.currencies.funds.subtract(cost);
			buildNewBuilding(tk);
			return true;
		} else {
			console.log("Cannot afford building");
		}
		return false;
	}

	function getNewPublicBuildingCost (building) {
		var baseCost = 100 + (g.buildingCounts.total * 10) + (g.floorCounts.total * 10);
		if (building) {
			return baseCost * building.costMultiplier;
		} else {
			return baseCost;
		}
	}

//===== Game Methods

	g.buildNewBuilding = buildNewBuilding;

//===== Game Data

	g.drawCityOn = true;

	g.buildings = [];
	g.buildingModifiers = {};
	g.floorCounts = {R: 0, C: 0, I: 0, P: 0};
	g.buildingCounts = {R: 0, C: 0, I: 0, P: 0};
	g.highestFloorCount = 0;

	g.thresholds = {
		R: BASE_THRESHOLD, C: BASE_THRESHOLD, I: BASE_THRESHOLD, P: BASE_THRESHOLD
	};

	g.taxes = {
		pop: 0.5, R: 0, C: 1, I: 1, P: -0.5
	};

	g.currencies = g.inc.currencies;

	g.inc.addCurrencies([
		{
			name: "day",
			displayName: "Day",
			val: 1
		},{
			name: "hour",
			displayName: "Hour",
			val: 12,
			rate: 0.1, // 1 hours = 10 seconds
			min: 0, max: 24,
			elementId: "hour"		
		},{
			name: "pop",
			displayName: "Population",
			rate: 1,
			min: 0,	max: 999999999,
			elementId: "pop",
			calcRate: function (c) {
				if (Math.floor(c.pop.val) == 0) {
					return 0.2;
				} else if (c.happiness.val > 0) {
					return 0.1 + (Math.round(c.happiness.getPercent()) * 1);
				} else {
					return -0.1;
				}
			},
			calcMax: function(){
				return (g.floorCounts.R * residentsPerBuilding);
			}
		},{
			name: "funds",
			displayName: "City Funds",
			val: 200,
			rate: 0,
			min: -9999,
			symbol: currencySymbol,
			elementId: "funds",
			calcRate: function (c) {
				return (c.taxIncomeR.val + c.taxIncomeC.val + c.taxIncomeI.val - c.publicBudget.val);
			},
			calcMax: function(c){
				return 500;
			}
		},{
			name: "happiness",
			calcRate: function (c) {
				var popDesiringCommercialJob = c.pop.val/3;
				var popDesiringIndustryJob = c.pop.val - popDesiringCommercialJob;
				var popDesiringServices = c.pop.val/2;
				if (c.buildingsR.val == 0) { return 50; } // Base immigration
				// Residential demand is based on jobs available 
				// and there needs to be plenty of public buildings per residential
				return (
					((c.buildingsC.val * jobsPerCommercialBuilding) - popDesiringCommercialJob)
					+ ((c.buildingsI.val * jobsPerIndustrialBuilding) - popDesiringIndustryJob)
					+ ((c.buildingsC.val * servicesPerCommercialBuilding) - popDesiringServices)
					+ (c.buildingsP.val - c.buildingsR.val)
					- (c.pollution.val / 100)
					- (c.crime.val / 100)
				);
			}, calcMax: function (c) {
				return Math.floor(c.pop.val) * 10;
			}
		},{
			name: "crime",
			calcRate: function (c) {
				return 0;
			},
			calcMax: function (c) {
				return ((Math.floor(c.pop.val) * 10) + (g.buildingCounts.total * 10));
			}
		},{
			name: "corruption",
			calcRate: function (c) {
				return (c.crime.getPercent() * 2)
					+ (c.funds.getPercent() > .75) ? 1 : 0
			},
			calcMax: function (c) {
				return g.floorCounts.P * 10;
			}
		},{
			name: "electricity",
			max: 0,
			calcRate: function (c) {
				return (g.buildingCounts.total * -0.1);
			}
		},{
			name: "pollution",
			calcRate: function (c) {
				return g.floorCounts.I;
			},
			calcMax: function (c) {
				return g.buildingCounts.total * 100;
			}
		}



	//===== RCIP
		,{
			name: "buildingsR",
			min: 0,	max: MAX_BUILDINGS, val: 0,
			calcValue: function() { return g.buildingCounts.R; }
		},{
			name: "buildingsC",
			min: 0,	max: MAX_BUILDINGS,
			calcValue: function() { return g.buildingCounts.C; }
		},{
			name: "buildingsI",
			min: 0,	max: MAX_BUILDINGS,
			calcValue: function() { return g.buildingCounts.I; }
		},{
			name: "buildingsP",
			min: 0,	max: MAX_BUILDINGS,
			calcValue: function() { return g.buildingCounts.P; }
		},{
			name: "floorsR",
			min: 0,	max: MAX_FLOORS, val: 0,
			calcValue: function() { return g.floorCounts.R; }
		},{
			name: "floorsC",
			min: 0,	max: MAX_FLOORS,
			calcValue: function() { return g.floorCounts.C; }
		},{
			name: "floorsI",
			min: 0,	max: MAX_FLOORS,
			calcValue: function() { return g.floorCounts.I; }
		},{
			name: "floorsP",
			min: 0,	max: MAX_FLOORS,
			calcValue: function() { return g.floorCounts.P; }
		},{
			elementId: "demandR",
			val: 0,	min: MIN_DEMAND,	max: MAX_DEMAND,
			calcRate: function (c) {
				return c.happiness.rate;
			}
		},{
			name: "demandC",
			val: 0,	min: MIN_DEMAND,	max: MAX_DEMAND,
			calcRate: function (c) {
				return ((c.buildingsR.val - c.buildingsC.val) + (c.buildingsI.val - c.buildingsC.val));
			}
		},{
			name: "demandI",
			val: 0,	min: MIN_DEMAND, 	max: MAX_DEMAND,
			calcRate: function (c) {
				return ((c.buildingsR.val - c.buildingsI.val) + (c.buildingsC.val - c.buildingsI.val));
			}
		},{
			name: "demandP",
			val: 0,	min: MIN_DEMAND,	max: MAX_DEMAND,
			calcRate: function (c) {
				return (c.buildingsR.val - c.buildingsP.val);
			}
		},{
			name: "taxIncomeR",
			val: 0, min: -999, max: 999,
			symbol: currencySymbol,
			calcValue: function (c) {
				return (c.pop.val * g.taxes.pop) + (c.buildingsR.val * g.taxes.R);
			}
		},{
			name: "taxIncomeC",
			val: 0, min: -999, max: 999,
			symbol: currencySymbol,
			calcValue: function (c) {
				return (c.buildingsC.val * g.taxes.C);
			}
		},{
			name: "taxIncomeI",
			val: 0, min: -999, max: 999,
			symbol: currencySymbol,
			calcValue: function (c) {
				return (c.buildingsI.val * g.taxes.I);
			}
		},{
			name: "publicBudget",
			val: 0, min: 0, max: 0,
			rate: 0,
			symbol: currencySymbol,
			calcVal: function () { return 0; },
			calcMax: function () { return 0; }
		}
	]);

	$('.grant').click(function(e){
		var $button = $(e.target);
		var buildingTypeKey = $button.closest('.building-type').data("building");
		g.currencies["demand" + buildingTypeKey].add(10);
		g.currencies.funds.subtract(100);
	});
	$('.tabs nav').on("click", "a", function(e){
		var $link = $(e.target);
		var tabClass = $link.data("tab");
		var $tabs = $link.closest('.tabs');
		var $allLinks = $tabs.find('nav a');
		$allLinks.removeClass("open");
		$link.addClass("open");
		//$link.closest('.tabs').addClass(tabClass);
		$('div.tabs > div').removeClass("open").filter("." + tabClass).addClass("open");
	});
	$('.pause').on("click", function(){
		if (g.state.currentState.name == "watch") {
			g.state.transition("pause");
		} else {
			g.state.transition("watch");
		}
	});
	$('.cityDrawToggle').click(function(e){
		g.drawCityOn = !g.drawCityOn;
		console.log("drawCityOn", g.drawCityOn);
		g.draw();
	});
	$('.upgrades').on("click", "button", function(e){
		var $button = $(e.target);
		var $what = $button.closest('li');
		var templateKey = $what.data("templatekey");
		buyBuilding(templateKey);
	});


	console.log(g);

	g.state.transition("watch");

});