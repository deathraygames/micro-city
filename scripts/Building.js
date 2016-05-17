(function(){
	var component = {
		fileName: 		"Building",
		classes:		["Building"],
		requirements:	[],
		description:	"building class for micro city",
		credits:		"By Luke Nickerson, 2016"
	};
	var _defaultTemplateKeyByType = {
		"R": "apartment",
		"C": "shop",
		"I": "factory",
		"P": "park"
	};
	var _buildingTemplates = {
		"apartment": {
			name: "Apartment",
			type: "R",
			costMultiplier: 1,
			currencyModifiers: {
				electricity: {rate: -0.1},
				crime: {rate: 0.5}
			}
		},
		"shop": {
			name: "Shop",
			type: "C",
			costMultiplier: 1,
			currencyModifiers: {
				electricity: {rate: -0.1},
				crime: {rate: 0.5}
			}
		},
		"factory": {
			name: "Factory",
			type: "I",
			maxFloors: 3,
			costMultiplier: 1,
			currencyModifiers: {
				electricity: {rate: -0.1},
				crime: {rate: 1}
			}
		},
		"park": {
			name: "Park",
			type: "P",
			costMultiplier: 1,
			currencyModifiers: {
				electricity: {rate: -0.1},
				pop: {rate: -1},
				pollution: {rate: -1},
				crime: {rate: 0.5},
				publicBudget: {val: 1, max: 1}
			}
		},
		"admin": {
			name: "Bureaucracy Administration",
			type: "P",
			costMultiplier: 1,
			currencyModifiers: {
				electricity: {rate: -0.1},
				funds: {rate: 0.1, max: 100, min: -100},
				publicBudget: {val: 1, max: 1}
			}
		},		
		"police": {
			name: "Police Station",
			type: "P",
			costMultiplier: 2,
			currencyModifiers: {
				electricity: {rate: -0.1},
				crime: {rate: -10},
				publicBudget: {val: 10, max: 10}
			}
		},
		"coal": {
			name: "Coal Plant",
			type: "P",
			costMultiplier: 4,
			currencyModifiers: {
				electricity: {max: 100, rate: 10},
				pollution: {rate: 2},
				publicBudget: {val: 20, max: 20}
			}
		}		
	};

	var Building = component.Building = function Building (options){
		options = options || {};
		this.templateKey = options.templateKey || this.getDefaultTemplateKeyByType(options.type);
		this.template = RocketBoots._.cloneDeep(_buildingTemplates[this.templateKey]);
		this.name = this.template.name;
		this.costMultiplier = this.template.costMultiplier;
		this.floors = 1;
		this.maxFloors = (options.maxFloors || 163);
		this.type = this.template.type;
		this.currencyModifiers = RocketBoots._.cloneDeep(this.template.currencyModifiers);
	};

	
	Building.prototype.addFloor = function(amount){
		amount = (typeof amount !== "number") ? 1 : Math.floor(amount);
		if (this.hasFloorSpace(amount)) {
			this.floors += amount;
			return true;
		} else {
			return false;
		}
	};
	Building.prototype.hasFloorSpace = function (amount) {
		amount = (typeof amount !== "number") ? 1 : Math.floor(amount);
		return (this.floors + amount <= this.maxFloors) ? true : false;
	}
	Building.prototype.getDefaultTemplateKeyByType = function (type) {
		return _defaultTemplateKeyByType[type];
	}



	// Install into RocketBoots if it exists, otherwise make global
	if (typeof RocketBoots == "object") {
		RocketBoots.installComponentByObject(component); // FIXME: switch back to installComponent when fixed
	} else {
		window["Building"] = Building;
	}
})();