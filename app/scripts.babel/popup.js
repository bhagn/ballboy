'use strict';

(function() {
  var seriesTemplate = `
    <div class="series">
      <div class="series-header" ng-bind="ctrl.data.label"></div>
      <div class="series-date">
        <span ng-bind="ctrl.data.start"></span> - <span ng-bind="ctrl.data.end"></span>
      </div>
    </div>
  `;

  function SeriesController() {
    var vm = this;
  }

  function SeriesDirective() {
    return {
      scope: {
        data: '<'
      },
      template: seriesTemplate,
      controller: SeriesController,
      controllerAs: 'ctrl',
      bindToController: true
    }
  }

  function Controller($scope) {
    $scope.series = [];
    $scope.liveMatches = [];
    $scope.menu = {
      active: 'series'
    };

    chrome.storage.sync.get('series', data => {
      $scope.series = _.filter(data.series, {active: true});
      console.log($scope.series);
      $scope.$digest();
    });
  }

  Controller.$inject = ['$scope'];

  angular.module('ballBoyPopup', [])
    .controller('PopupController', Controller)
    .directive('bbSeries', SeriesDirective);
})();
