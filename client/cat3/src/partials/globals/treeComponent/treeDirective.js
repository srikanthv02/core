/* Copyright (C) Relevance Lab Private Limited- All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Relevance UI Team,
 * Aug 2015
 */

(function(angular) {
	'use strict';
	angular.module('angularTreeview', []).directive('treeModel', ['$compile', function($compile) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				//tree id-----basically this is an object inside the scope from where we can access the click methods
				var treeId = attrs.treeId || "relevancelab";
				//tree model
				var treeModel1 = attrs.treeModel;
				//node id
				var nodeId = attrs.nodeId || 'rowid';
				//node label
				var nodeLabel = attrs.nodeLabel || 'text';
				//children
				var nodeChildren = attrs.nodeChildren || 'nodes';
				//tree template
				var template =
					'<ul>' +
					'<li data-ng-repeat="node in ' + treeModel1 + '">' +
					'<i class="expand-collapse click-expand fa fa-angle-right collapse-spacing" data-ng-show="node.' + nodeChildren + '.length && node.collapsed" data-ng-click="' + treeId + '.selectNodeHead(node)"></i>' +
					'<i class="expand-collapse click-collapse fa fa-angle-down collapse-spacing" data-ng-show="node.' + nodeChildren + '.length && !node.collapsed" data-ng-click="' + treeId + '.selectNodeHead(node)"></i>' +
					'<span class="{{getClass(node)}}" data-ng-click="' + treeId + '.selectNodeHead(node)"></span>'+
					
					/*'<i class="normal" data-ng-hide="node.' + nodeChildren + '.length" data-ng-click="' + treeId + '.selectNodeHead(node)"></i> ' +*/
					'<span data-ng-class="node.selected" data-nodetype="{{getNodeType(node)}}" data-ng-click="' + treeId + '.selectNodeLabel(node)" id="{{node.rowid}}">{{node.' + nodeLabel + '}}</span>' +
					'<div data-ng-hide="node.collapsed" data-tree-id="' + treeId + '" data-tree-model="node.' + nodeChildren + '" data-node-id=' + nodeId + ' data-node-label=' + nodeLabel + ' data-node-children=' + nodeChildren + '></div>' +
					'</li>' +
					'</ul>';


				//check tree id, tree model
				if (treeId && treeModel1) {

					//root node
					if (attrs.angularTreeview) {

						//create tree object if not exists
						scope[treeId] = scope[treeId] || {};

						//if node head clicks,
						scope[treeId].selectNodeHead = scope[treeId].selectNodeHead || function(selectedNode) {

							//Collapse or Expand
							selectedNode.collapsed = !selectedNode.collapsed;
							scope[treeId].selectNodeHeadCallback(selectedNode);
						};

						//if node label clicks,
						scope[treeId].selectNodeLabel = scope[treeId].selectNodeLabel || function(selectedNode) {

							//remove highlight from previous node
							if (scope[treeId].currentNode && scope[treeId].currentNode.selected) {
								scope[treeId].currentNode.selected = undefined;
							}

							//set highlight to selected node
							selectedNode.selected = 'selected';

							//set currentNode
							scope[treeId].currentNode = selectedNode;

							scope[treeId].selectNodeLabelCallback(selectedNode);
						};

					scope.getNodeType=function(node){
						if(node.selectable===false){
							return "not-env";
						}else{
							return "env";
						}
					};

					scope.getClass=function(node){
						var extraClass="label-spacing";
						if(node.selectable===false && !node.orgname){
						return "icon fa fa-building" +" "+extraClass;
					}else if(node.selectable===false && node.orgname && !node.bgname){
						return "icon fa fa-fw fa-1x fa-group" +" "+extraClass;
					}else if(node.selectable===false && node.orgname && node.bgname && !node.projname){
						return "icon fa fa-fw fa-1x fa-tasks" +" "+extraClass;

					}else if(node.selectable===undefined){
						return "icon fa fa-fw fa-1x fa-desktop" +" "+extraClass;
					}
					};
					}
					//Rendering template.
					element.html('').append($compile(template)(scope));
				}
			}
		};
	}]);
})(angular);