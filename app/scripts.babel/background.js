'use strict';
(function() {
  var series = [];
  var URL = {
    INDEX: 'http://www.bcci.tv/',
    SCHEDULE: 'http://domesticdata.bcci.tv/live/seriesId/matchSchedule2.js'
  };

  function Response(callback) {
    // TODO: error handling
    return function(response) {
      if (response.target.readyState !== 4) {
        return;
      }
      callback(response.target.responseText);
    };
  }

  function xhrGET(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = Response(callback);
    xhr.open('GET', url, true);
    xhr.send();
  }

  function setUpAlarms() {

  }

  function onSeriesDetailsLoad(detail) {
    detail = detail.replace('onMatchSchedule(', '').replace(');', '');
    detail = JSON.parse(detail);
    console.log('loading details')

    chrome.storage.sync.get('series', data => {
      var series = data.series;
      var toEdit = _.findIndex(series, {name: detail.tournamentId.name});

      if (toEdit !== -1) {
        var start = moment(detail.schedule[0].matchDate);
        var end = moment(_.last(detail.schedule).matchDate);
        var today = moment();

        series[toEdit].label = detail.tournamentId.tournamentLabel;
        series[toEdit].id = detail.tournamentId.id;
        series[toEdit].start = start.format('MMM Do');
        series[toEdit].end = end.format('MMM Do');
        if (start > today || today > end) {
          series[toEdit].active = false;
        } else {
          series[toEdit].active = true;
        }

        chrome.storage.sync.set({series: series});
      }

      getSeriesDetails();

    });
  }

  function getSeriesDetails() {
    if (series.length === 0) {
      return;
    }

    var s = series.pop();
    var url = URL.SCHEDULE.replace('seriesId', s.name);
    xhrGET(url, onSeriesDetailsLoad);
  }

  function onSeriesLoad(homePage) {
    var div = document.createElement('div');
    div.innerHTML = homePage;

    series = div.querySelector('[data-tab="domestic"]').getAttribute('data-dom-season').split(', ');

    series = _.map(series, name => {
      return { name: name };
    });

    chrome.storage.sync.set({
      series: series
    });

    getSeriesDetails(series);
  }

  function getSeries() {
    xhrGET(URL.INDEX, onSeriesLoad);
  }

  chrome.runtime.onInstalled.addListener(details => {
    console.log('previousVersion', details.previousVersion);
    chrome.alarms.clearAll(getSeries);
  });

  chrome.browserAction.setBadgeText({text: 'live'});

})();
