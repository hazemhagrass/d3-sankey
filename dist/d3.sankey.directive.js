'use strict';
angular.module('ngSankey', []).directive('ngSankey', function () {
    let id = 'ng-sankey-' + parseInt(Math.random() * 1000);
    return{
        restrict: 'E',
        template: '<div id="' + id + '"><canvas></canvas><svg></svg></div>',
        scope: {
            data: '=',
            options: '='
        },
        controller: ["$scope", "$timeout", function ($scope, $timeout) {
            var chart = '';
            $scope.$watch("data", function (data) {
                if(!$scope.data)
                    return;

                if(chart){
                    d3.selectAll('#' + id + ' svg g').remove();
                }
                
                $scope.options.chart = '#' + id;
                chart = new d3.sankeyChart($scope.data, $scope.options);
            })
        }]
    }
});
