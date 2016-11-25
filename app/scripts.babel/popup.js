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

  var liveMatchTemplate = `
    <div class="live-match">
      <div class="sub-header" ng-bind="ctrl.data.desc"></div>
      <div class="result" ng-if="ctrl.data.status === 'C'" ng-bind="::ctrl.data.result.text">
      </div>
      <div ng-if="ctrl.data.status !== 'C'" class="scorecard">
        N/A
      </div>
    </div>
  `;

  function LiveMatchDirective() {
    return {
      scope: {
        data: '<'
      },
      template: liveMatchTemplate,
      controller: function() {},
      controllerAs: 'ctrl',
      bindToController: true
    };
  }


  function SeriesDirective() {
    return {
      scope: {
        data: '<'
      },
      template: seriesTemplate,
      controller: function() {},
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

    chrome.storage.sync.get('live', data => {
      $scope.liveMatches = data.live;
      if (data.live.length > 0) {
        $scope.menu.active = 'live';
      } else {
        $scope.menu.active = 'series';
      }

      $scope.$digest();
    });
  }

  Controller.$inject = ['$scope'];

  angular.module('ballBoyPopup', [])
    .controller('PopupController', Controller)
    .directive('bbSeries', SeriesDirective)
    .directive('bbLiveMatch', LiveMatchDirective);
})();
