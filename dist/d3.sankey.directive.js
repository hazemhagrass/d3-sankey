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
                if(!$scope.data || !$scope.data.nodes.length)
                    d3.select('#' + id + ' svg').append("text")
                        .attr("class", "nvd3 nv-noData")
                        .attr("transform", "translate(507, 250)")
                        .attr("text-anchor", "middle")
                        .attr("opacity", 1)
                        .text("No Data Available.");
                else
                    d3.select('#' + id + ' svg text.nv-noData').attr("opacity", 0);

                if(chart){
                    d3.selectAll('#' + id + ' svg g').remove();
                }
                
                $scope.options.chart = '#' + id;
                chart = new d3.sankeyChart($scope.data, $scope.options);
            })
        }]
    }
});
