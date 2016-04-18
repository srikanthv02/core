(function(){
    "use strict";
    angular.module('workzone.orchestration').controller('orchestrationLogCtrl',["items",'$scope','$modalInstance','$controller',function(items,$scope,$modalInstance,$controller){
        $scope.parentItemDetail=items;
        var orchLogCtrl={};
        orchLogCtrl.taskLogType=items.taskType;
        orchLogCtrl.cancelAll=function(){
            $scope.$broadcast ('closeWindow');
            $modalInstance.dismiss('cancel');
            return  $scope.close;
        }
        return orchLogCtrl;
    }]);
})();
