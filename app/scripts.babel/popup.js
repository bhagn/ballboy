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
    };
  }

  function Controller($scope) {
    $scope.series = [];
    $scope.liveMatches = [];
    $scope.teams = [];
    $scope.menu = {
      active: null
    };
    $scope.favTeams = [];

    $scope.toggleFavouriteTeam = (teamName) => {
      var index = $scope.favTeams.indexOf(teamName);
      if (index === -1) {
        $scope.favTeams.push(teamName);
      } else {
        $scope.favTeams.splice(index, 1);
      }

      chrome.storage.sync.set({favTeams: $scope.favTeams});
      $scope.$digest();
    };

    chrome.storage.sync.get('series', data => {
      $scope.series = _.filter(data.series, {active: true});
      console.log($scope.series);
      $scope.$digest();
    });

    chrome.storage.sync.get('teams', data => {
      $scope.teams = _.groupBy(data.teams, 'series');
      $scope.$digest();
    });

    chrome.storage.sync.get('favTeams', data => {
      if (!data || _.isEmpty(data.favTeams)) {
        $scope.menu.active = 'teams';
      } else {
        $scope.favTeams = data.favTeams;
      }

      $scope.$digest();
    });
  }

  Controller.$inject = ['$scope'];

  angular.module('ballBoyPopup', [])
    .controller('PopupController', Controller)
    .directive('bbSeries', SeriesDirective);
})();
