/*
 Copyright [2016] [Relevance Lab]

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var logger = require('_pr/logger')(module);
var resourceMetricsModel = require('_pr/model/resource-metrics');
var resourceCostsModel =  require('_pr/model/resource-costs')
var entityCostsModel =  require('_pr/model/entity-costs')
const dateUtil = require('_pr/lib/utils/dateUtil')
var appConfig = require('_pr/config');
var async = require('async')
var d4dModelNew = require('_pr/model/d4dmasters/d4dmastersmodelnew.js')
var AWSProvider = require('_pr/model/classes/masters/cloudprovider/awsCloudProvider.js')

var analyticsService = module.exports = {};

// @TODO To be reviewed and improved
analyticsService.validateAndParseCostQuery
	= function validateAndParseCostQuery(queryType, requestQuery, callback) {
	var costAggregationPeriods = appConfig.costAggregationPeriods

	if ((!('parentEntityId' in requestQuery)) || (!('entityId' in requestQuery))
		|| (!('toTimeStamp' in requestQuery)) || (!('period' in requestQuery))) {
		var err = new Error('Invalid request')
		err.errors = [{messages: 'Mandatory fields missing'}]
		err.status = 400
		callback(err)
	}

	var startTime
	switch (requestQuery.period) {
		case 'month':
			startTime = dateUtil.getStartOfAMonthInUTC(requestQuery.toTimeStamp)
			break
		/*case 'year':
			startTime = dateUtil.getStartOfAMonthInUTC(requestQuery.toTimeStamp)
			break*/
		default:
			var err = new Error('Invalid request')
			err.errors = [{messages: 'Period is invalid'}]
			err.status = 400
			return callback(err)
			break
	}

	//@TODO Query object format to be changed
	var costQuery = {
		totalCostQuery: [
			{'parentEntity.id': requestQuery.parentEntityId},
			{'entity.id': requestQuery.entityId},
			{'startTime': Date.parse(startTime)},
			{'period': requestQuery.period}
		]
	}

	if(queryType == 'aggregate') {
		costQuery.splitUpCostQuery = [
			{'parentEntity.id': requestQuery.entityId},
			{'startTime': Date.parse(startTime)},
			{'period': requestQuery.period}
		]
	}

	if(queryType == 'trend') {
		costQuery.costTrendQuery = [
			{'parentEntity.id': requestQuery.parentEntityId},
			{'entity.id': requestQuery.entityId},
			{'startTime': {$gte: Date.parse(startTime)}},
			{'endTime': {$lte: Date.parse(requestQuery.toTimeStamp)}},
			{'interval': costAggregationPeriods[requestQuery.period].childInterval.intervalInSeconds}
		]
	}

	return callback(null, costQuery)
}

analyticsService.getEntityAggregateCosts = function getEntityAggregateCosts(costQuery, callback) {
	async.parallel({
		totalCost: function(next) {
			entityCostsModel.getEntityCost(costQuery.totalCostQuery, next)
		},
		splitUpCosts: function(next) {
			entityCostsModel.getEntityCost(costQuery.splitUpCostQuery, next)
		}
	}, function(err, entityCosts) {
		if(err) {
			logger.error(err)
			var err = new Error('Internal Server Error')
			err.status = 500
			return callback(err)
		} else if(entityCosts.totalCost == null) {
			var err = new Error('Data not available')
			err.status = 400
			return callback(err)
		} else {
			return callback(null, entityCosts)
		}
	})
}

analyticsService.getEntityCostTrend = function getEntityCostTrend(costQuery, callback) {
	async.parallel({
		totalCost: function(next) {
			entityCostsModel.getEntityCost(costQuery.totalCostQuery, next)
		},
		costTrend: function(next) {
			entityCostsModel.getEntityCost(costQuery.costTrendQuery, next)
		}
	}, function(err, entityCosts) {
		if(err) {
			logger.error(err)
			var err = new Error('Internal Server Error')
			err.status = 500
			return callback(err)
		} else if(entityCosts.totalCost == null) {
			var err = new Error('Data not available')
			err.status = 400
			return callback(err)
		} else {
			return callback(null, entityCosts)
		}
	})
}

// @TODO Try to opitmize
analyticsService.formatAggregateCost = function formatAggregateCost(entityCosts, callback) {
	var catalystEntityHierarchy = appConfig.catalystEntityHierarchy

	async.waterfall([
		function(next) {
			var totalCost = Math.round(entityCosts.totalCost[0].costs.totalCost * 100) / 100
			var formattedAggregateCost = {
				period: entityCosts.totalCost[0].period,
				fromTime: entityCosts.totalCost[0].startTime,
				toTime: entityCosts.totalCost[0].endTime,
				entity: {
					type: entityCosts.totalCost[0].entity.type,
					id: entityCosts.totalCost[0].entity.id,
					name: entityCosts.totalCost[0].entity.name
				},
				cost: {
					totalCost: totalCost,
					AWS: {
						totalCost: totalCost,
						serviceCosts: {
							Other: totalCost
						}
					}
				},
				splitUpCosts: {}
			}

			analyticsService.getEntityDetails(formattedAggregateCost.entity.type,
				formattedAggregateCost.entity.id,
				function(err, entityDetails) {
					if(err) {
						next(err)
					} else {
						formattedAggregateCost.entity.name = entityDetails.name
						next(null, formattedAggregateCost)
					}
				}
			)
		},
		function(formattedAggregateCost, next) {
			async.forEach(entityCosts.splitUpCosts,
				function(costEntry, next0) {
					if (costEntry.entity.type == entityCosts.totalCost[0].entity.type) {
						return next0()
					}

					if (!(costEntry.entity.type in formattedAggregateCost.splitUpCosts)) {
						formattedAggregateCost.splitUpCosts[costEntry.entity.type] = []
					}

					var splitUpCost = {
						id: costEntry.entity.id,
						// name: costEntry.entity.name,
						cost: {
							totalCost: Math.round(costEntry.costs.totalCost * 100) / 100,
							AWS: {
								totalCost: Math.round(costEntry.costs.totalCost * 100) / 100,
								serviceCosts: {
									Other: Math.round(costEntry.costs.totalCost * 100) / 100
								}
							}
						}
					}

					if (costEntry.entity.id != 'Unassigned' && costEntry.entity.id != 'Other'
						&& costEntry.entity.id != 'Unknown') {
						analyticsService.getEntityDetails(costEntry.entity.type, costEntry.entity.id,
							function (err, entityDetails) {
								if (err) {
									next0(err)
								} else {
									splitUpCost.name = entityDetails.name
									formattedAggregateCost.splitUpCosts[costEntry.entity.type].push(splitUpCost)
									next0()
								}
							}
						)
					} else {
						splitUpCost.name = costEntry.entity.id
						formattedAggregateCost.splitUpCosts[costEntry.entity.type].push(splitUpCost)
						next0()
					}
				},
				function(err) {
					if(err) {
						return next(err)
					} else {
						return next(null, formattedAggregateCost)
					}
				}
			)
		}
	], function(err, formattedAggregateCost) {
		if(err) {
			logger.error(err)
			var err = new Error('Internal Server Error')
			err.status = 500
			callback(err)
		} else {
			return callback(null, formattedAggregateCost)
		}
	})
}

// @TODO Try to opitmize
analyticsService.formatCostTrend = function formatCostTrend(entityCosts, callback) {
	var catalystEntityHierarchy = appConfig.catalystEntityHierarchy

	async.waterfall(
		[
			function(next) {
				var formattedCostTrend = {
					costTrends: []
				}
				if(entityCosts.totalCost != null) {
					var totalCost = Math.round(entityCosts.totalCost[0].costs.totalCost * 100) / 100
					formattedCostTrend = {
						period: entityCosts.totalCost[0].period,
						fromTime: entityCosts.totalCost[0].startTime,
						toTime: entityCosts.totalCost[0].endTime,
						entity: {
							type: entityCosts.totalCost[0].entity.type,
							id: entityCosts.totalCost[0].entity.id,
							name: entityCosts.totalCost[0].entity.name
						},
						cost: {
							totalCost: totalCost,
							AWS: {
								totalCost: totalCost,
								serviceCosts: {
									Other: totalCost
								}
							}
						},
						costTrends: []
					}
				}

				analyticsService.getEntityDetails(formattedCostTrend.entity.type,
					formattedCostTrend.entity.id,
					function(err, entityDetails) {
						if(err) {
							next(err)
						} else {
							formattedCostTrend.entity.name = entityDetails.name
							next(null, formattedCostTrend)
						}
					}
				)
			},
			function(formattedCostTrend, next) {
				async.forEach(entityCosts.costTrend,
					function(costEntry, next0) {
						var trend = {
							fromTime: costEntry.startTime,
							toTime: costEntry.endTime,
							cost: {
								totalCost: Math.round(costEntry.costs.totalCost * 100)/100,
								AWS: {
									totalCost: Math.round(costEntry.costs.totalCost * 100)/100,
									serviceCosts: {
										Other: Math.round(costEntry.costs.totalCost * 100)/100
									}
								}
							}
						}

						formattedCostTrend.costTrends.push(trend)
						next0()
					},
					function(err) {
						if(err) {
							logger.error(err)
							var err = new Error('Internal Server Error')
							err.status = 500
							return next(err)
						} else {
							return next(null, formattedCostTrend)
						}
					}
				)
			}
		],
		function(err, formattedCostTrend) {
			if(err) {
				callback(err)
			} else {
				callback(null, formattedCostTrend)
			}
		}
	)
}

//@TODO To be optimized. Better abstractions and attribute naming conventions will guarantee less code duplication
//@TODO Centralized error handling to reduce code duplication
analyticsService.getEntityDetails = function getEntityDetails(entityType, entityId, callback) {
	var notFoundError = new Error('Invalid entity id')
	notFoundError.status = 404

	var internalServerError =  new Error('Internal Server Error')
	internalServerError.status = 500

	switch(entityType) {
		case 'organization':
			d4dModelNew.d4dModelMastersOrg.find(
				{ rowid: entityId },
				function(err, organizations) {
					if (err) {
						logger.error(err)
						callback(internalServerError)
					} else if (organizations.length > 0) {
						callback(null, {'name': organizations[0].orgname})
					} else {
						callback(notFoundError)
					}
				}
			)
			break
		// NOTE: Currently works only for AWS providers
		case 'provider':
			AWSProvider.getAWSProviderById(entityId,
				function(err, provider) {
					if(err) {
						logger.error(err)
						callback(internalServerError)
					} else if(provider == null) {
						callback(notFoundError)
					} else {
						callback(null, {'name': provider.providerName})
					}
				}
			)
			break
		case 'businessGroup':
			d4dModelNew.d4dModelMastersProductGroup.find(
				{ rowid: entityId },
				function(err, businessGroups) {
					if (err) {
						logger.error(err)
						callback(internalServerError)
					} else if(businessGroups.length > 0) {
						callback(null, {'name': businessGroups[0].productgroupname})
					} else {
						callback(notFoundError)
					}
				}
			)
			break
		case 'project':
			d4dModelNew.d4dModelMastersProjects.find(
				{ rowid: entityId },
				function(err, projects) {
					if (err) {
						logger.error(err)
						callback(internalServerError)
					} else if(projects.length > 0) {
						callback(null, {'name': projects[0].projectname})
					} else {
						callback(notFoundError)
					}
				}
			)
			break
		case 'environment':
			d4dModelNew.d4dModelMastersEnvironments.find(
				{ rowid: entityId },
				function(err, environments) {
					if (err) {
						logger.error(err)
						callback(internalServerError)
					} else if (environments.length > 0) {
						callback(null, {'name': environments[0].environmentname})
					} else {
						callback(notFoundError)
					}
				}
			)
			break
		// NOTE: Works only for AWS regions as of now
		case 'region':
			callback(null, {'name': appConfig.aws.regionMappings[entityId].name})
			break
	}
}

/*analyticsService.getTrendUsage = function getTrendUsage(resourceId, interval, startTime, endTime, callback) {*/
function getTrendUsage(resourceId, interval, startTime, endTime, callback) {
	resourceMetricsModel.getByParams(resourceId, interval, startTime, endTime, function(err, datapoints){
		if(err) {
			callback(err, null);
        } else {
        	/* Format the data */
        	var metric = formatData(datapoints);
        	callback(null, metric);
        }
	});	
}

formatData(null);

function formatData(datapoints){
	var metric = {};
	
	if(datapoints != null && datapoints != undefined && datapoints.length > 0){
		var metricNames = [];
		for (var key in datapoints[0].metrics) {
			  if (datapoints[0].metrics.hasOwnProperty(key)) {
				  metricNames.push(key);
			  }
		}
		
		for (i = 0; i < metricNames.length; i++) {
			var metricName = metricNames[i];
			var metricObject = {};
			metricObject.unit = appConfig.aws.cwMetricsUnits[metricName];
			metricObject.symbol = appConfig.aws.cwMetricsDisplayUnits[metricName];
			
			var dataPoints = [];
		    for (j = 0; j < datapoints.length; j++) {
		    	var datapointEntry = {};
		    	datapointEntry.fromTime = datapoints[j].startTime;
		    	datapointEntry.toTime = datapoints[j].endTime;
		    	for (statisticsKey in datapoints[j].metrics[metricName]) {
		    		datapointEntry[statisticsKey] = datapoints[j].metrics[metricName][statisticsKey]
		    	}
		    	dataPoints.push(datapointEntry);
		    }
		    metricObject.dataPoints = dataPoints;
		    metric[metricName] = metricObject;
		}
	}
	return metric;
}

analyticsService.getTrendUsage = getTrendUsage;