/* Copyright (C) Relevance Lab Private Limited- All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Relevance UI Team,
 * April 2016
 */
(function(angular) {
    "use strict";
    angular.module('workzone.blueprint')
        .controller('dockerLaunchParamsCtrl', ['$scope', '$modal', '$modalInstance', 'workzoneServices', '$q', 'items', 'confirmbox', function($scope, $modal, $modalInstance, workzoneServices, $q, items, confirmbox) {
            angular.extend($scope, {
                cancel: function() {
                    $modalInstance.dismiss('cancel');
                },
            });
            $scope.dockerDetails = [];
            //items gives the details of the selected blueprint.
            var dockerParams = items.blueprintConfig.dockerCompose;

            //gives the dockerParams details to show up the image in the first step of wizard.
            dockerParams.forEach(function(k, v) {
                $scope.dockerDetails.push(dockerParams[v]);
            });

            //call made to get the instance details.(instance name,instanceIP)
            workzoneServices.getCurrentSelectedEnvInstanceList().then(function(response) {
                var data;
                data = response.data.instances;
                $scope.instanceData = data;
            });


            //modal to show the Docker Parameters Popup
            $scope.launchParam = function(launchObj, idx) {
                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'src/partials/sections/dashboard/workzone/blueprint/popups/dockerParams.html',
                    controller: 'dockerParamsCtrl',
                    backdrop: 'static',
                    keyboard: false,
                    resolve: {
                        items: function() {
                            return launchObj.dockerlaunchparameters;
                        }
                    }
                });
                modalInstance.result.then(function(paramStr) {
                    $scope.dockerDetails[idx].dockerlaunchparameters = paramStr;
                    //updating the dockerLaunchParameters for the particular index.
                }, function() {
                    console.log('Modal Dismissed at ' + new Date());
                });
            };
            //view the instance logs on click of more info and on start button click.
            $scope.viewLogs = function(instanceObj) {
                var _viewLogs = function(resolve, reject) {
                    var modalInstance = $modal.open({
                        animation: true,
                        templateUrl: 'src/partials/sections/dashboard/workzone/instance/popups/instancelog.html',
                        controller: 'instanceLogsCtrl',
                        backdrop: 'static',
                        keyboard: false,
                        resolve: {
                            items: function() {
                                return instanceObj;
                            }
                        }
                    });
                    modalInstance.result.then(function(modalClose) {
                        resolve(modalClose);
                    }, function(modalCancel) {
                        reject(modalCancel);
                    });
                };
                return $q(_viewLogs);
            };

            //wizard data setting for step 1 and step 2.
            var index = 0, // points to the current step in the steps array
                steps = $scope.steps = [{
                    'isDisplayed': true,
                    'name': 'dockerimages',
                    'title': 'Docker Images'
                }, {
                    'isDisplayed': false,
                    'name': 'instances',
                    'title': 'Instances'
                }];

            $scope.nextEnabled = true;
            $scope.previousEnabled = false;
            $scope.submitEnabled = false;

            $scope.next = function() {
                if (steps.length === 0) {
                    console.debug('No steps provided.');
                    return;
                }
                // If we're at the last step, then stay there.
                if (index == steps.length - 1) {
                    return;
                }

                steps[index++].isDisplayed = false;
                steps[index].isDisplayed = true;
                $scope.setButtons();
            };

            /* Moves to the previous step*/
            $scope.previous = function() {
                if (steps.length === 0) {
                    console.debug('No steps provided.');
                    return;
                }
                if (index === 0) {
                    console.debug('At first step');
                    return;
                }
                steps[index--].isDisplayed = false;
                steps[index].isDisplayed = true;
                $scope.setButtons();
            }; // $scope.previous


            /* Sets the correct buttons to be enabled or disabled.*/
            $scope.setButtons = function() {
                if (index == steps.length - 1) {
                    $scope.nextEnabled = false;
                    $scope.previousEnabled = true;
                    $scope.submitEnabled = true;
                } else if (index === 0) {
                    $scope.previousEnabled = false;
                    $scope.nextEnabled = true;
                    $scope.submitEnabled = false;
                } else {
                    $scope.nextEnabled = true;
                    $scope.previousEnabled = true;
                    $scope.submitEnabled = false;
                }
            };


            /*user sets the value(instanceId and instance) on the checkbox 
            the user has selected to show the logs once the user clicks on submit
            and restricts the selection to 1*/
            $scope.value = [];
            $scope.limit = 1; /*limiting the checkbox selection to 1*/
            $scope.checked = 0; /*checking the number of checkbox selection.Initially 0*/
            $scope.selectValue = function(instance) {
                $scope.value = $scope.value || [];
                if (instance.checked) {
                    $scope.instanceSelected = instance;
                    $scope.value.push(instance);
                    $scope.checked++;
                    $scope.value = _.uniq($scope.value);
                } else {
                    $scope.value = _.without($scope.value, instance);
                    $scope.checked--;
                }
            };

            $scope.submit = function() {
                var dockerImageParams = JSON.stringify($scope.dockerDetails);
                var repopath = "null"; //by default set to null.(taken from 2.0);
                workzoneServices.postDockerLaunchParamsBlueprint($scope.instanceSelected._id, repopath, {
                    compositedockerimage: encodeURIComponent(dockerImageParams)
                }).then(function(response) {
                    var data = response.data;
                    /*If Response is ok the logs are shown and docker image is pulled*/
                    if (data == "OK") {
                        $scope.viewLogs($scope.instanceSelected);
                    } else {
                        if (data.indexOf('No Docker Found') >= 0) {
                            var modalOptions = {
                                closeButtonText: 'Cancel',
                                actionButtonText: 'Ok',
                                actionButtonStyle: 'cat-btn-update',
                                headerText: 'Warning',
                                bodyText: 'Docker was not found on the node : "' + $scope.instanceSelected.name + '". \nDo you wish to install it?'
                            };
                            confirmbox.showModal({}, modalOptions).then(function() {
                                //updateRunlist: function(type) {

                                //}
                            });
                        }
                    }
                });
            };
        }])
})(angular);