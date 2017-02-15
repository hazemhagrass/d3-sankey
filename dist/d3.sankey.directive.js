function initNGSankey(app) {
    app.directive('ngSankey', function () {
        let id = 'ng-sankey-' + parseInt(Math.random() * 1000);
        let chart, data, options = null;
        return {
            restrict: 'E',
            template: '<div id="' + id + '"><canvas></canvas><svg></svg></div>',
            controller: function () {

            },
            link: function (scope, iElement, iAttrs) {
                options = JSON.parse(iAttrs.options);
                options.chart = '#' + id;

                data = JSON.parse(iAttrs.source);
                chart = new d3.sankeyChart(data, options);
            }
        }
    });
}
