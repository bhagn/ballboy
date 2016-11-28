'use strict';

(function() {
  var series = [];
  var teams = [];
  var live = [];
  var favTeams = [];
  var port = null;
  var liveScores = [];

  var URL = {
    INDEX: 'http://www.bcci.tv/',
    SCHEDULE: 'http://domesticdata.bcci.tv/live/seriesId/matchSchedule2.js',
    DOM_LIVE: 'http://domesticdata.bcci.tv/live/seriesId/matchId/scoring.js',
    INT_SCHEDULE: 'http://dynamic.pulselive.com/dynamic/data/core/cricket/2012/seriesId/matchSchedule2.js',
    INT_LIVE: 'http://dynamic.pulselive.com/dynamic/data/core/cricket/2012/seriesId/matchId/scoring.js'
  };

  var iconUrl = chrome.extension.getURL('images/icon-48.png');

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

  function parseAndSetLiveScore(score) {
    score = JSON.parse(score.replace('onScoring(', '').replace(');', ''));
    chrome.storage.sync.get('live', live => {
      var matches = live.live;
      var toEdit = _.findIndex(matches, {id: score.matchId.name});

      if (toEdit === -1) {
        console.warn('couldn\'t find the live match', score.matchId.name, matches);
        return updateLiveScores();
      }

      matches[toEdit].matchInfo = score.matchInfo.description;

      var data = {
        summary: score.matchInfo.matchSummary,
      };

      var innings = [];
      for (var i=0; i < score.innings.length; i++) {
        var teamInfo = score.matchInfo.teams[score.matchInfo.battingOrder[i]];
        var info = {
          name: teamInfo.team.abbreviation || teamInfo.team.fullName,
          pColor: '#' + teamInfo.team.primaryColor,
          sColor: '#' + teamInfo.team.secondaryColor,
          runs: score.innings[i].scorecard.runs,
          wkts: score.innings[i].scorecard.wkts,
          overs: score.innings[i].scorecard.overProgress
        };

        if (i === score.innings.length - 1 && score.matchInfo.matchState === 'L') {
          // if live
          var liveBatsmen = _.filter(score.innings[i].scorecard.battingStats, b => {
            return _.isUndefined(b.mod);
          });

          info.batsmen = [];

          info.batsmen.push({
            name: _.find(teamInfo.players, { id: liveBatsmen[0].playerId }).shortName,
            r: liveBatsmen[0].r,
            b: liveBatsmen[0].b,
            f: liveBatsmen[0]['4s'],
            s: liveBatsmen[0]['6s'],
            sr: liveBatsmen[0].sr
          });
          info.batsmen.push({
            name: _.find(teamInfo.players, { id: liveBatsmen[1].playerId }).shortName,
            r: liveBatsmen[1].r,
            b: liveBatsmen[1].b,
            f: liveBatsmen[1]['4s'],
            s: liveBatsmen[1]['6s'],
            sr: liveBatsmen[1].sr
          });
        }

        innings.push(info);
      }

      data.innings = innings;

      var notes = [];
      _.forEach(score.matchInfo.additionalInfo, (value, key) => {
        if (_.startsWith(key, 'notes')) {
          notes.push({
            id: parseInt(key.replace('notes.', '').replace(/\./g, '')),
            value: value
          });
        }
      });

      notes = notes.sort(function(a, b) {
        return b.id - a.id;
      });
      data.notes = notes[0].value;
      console.log(score.matchInfo.additionalInfo);

      if (matches[toEdit].data && matches[toEdit].data.notes != data.notes) {
        chrome.notifications.create(score.matchId.name, {
          type: 'basic',
          title: score.matchInfo.tournamentLabel + '(' + score.matchInfo.description + ')',
          message: data.notes,
          iconUrl: 'images/icon-48.png'
        });
        console.log('notification for', score.matchInfo.tournamentLabel + '(' + score.matchInfo.description + ')');
      }

      matches[toEdit].data = data;

      chrome.storage.sync.set({ live: matches }, data => {
        if (port) {
          port.postMessage('reload-view');
        }
      });

    });
  }

  function updateLiveScores() {
    if (liveScores.length === 0) {
      return;
    }

    var match = liveScores.pop();

    if (match.status === 'L') {
      xhrGET(match.url, parseAndSetLiveScore);
    } else {
      console.log('Match not live: ', match.id, 'skipping refresh');
      updateLiveScores();
    }
  }

  function getLiveScores() {
    liveScores = [];
    chrome.storage.sync.get('live', data => {
      liveScores = data.live;

      if (liveScores.length === 0) {
        init();  // clear all
      }
      updateLiveScores();
    });
  }

  function setUpAlarms() {
    chrome.storage.sync.get('live', data => {
      if (data.live.length === 0) {
        console.log('skipping adding alarm, no live matches');
        return;
      }

      console.log('Adding job to refresh every 15 minutes');

      chrome.alarms.create('liveScores', {
        periodInMinutes: 2
      });

      chrome.alarms.onAlarm.addListener(alarm => {
        console.log('Alarm triggered', alarm);
        if (alarm.name == 'liveScores') {
          getLiveScores();
        }
      });
    })

  }

  function populateLiveMatches(matches, seriesId, isIntMatch) {
    var today = moment().startOf('date');
    matches.forEach(match => {
      var team1 = match.team1.team.fullName;
      var team2 = match.team2.team.fullName;

      if (favTeams.indexOf(team1) === -1 && favTeams.indexOf(team2) === -1) {
        return;
      }

      var startDate = moment(match.matchDate).startOf('date');
      var noOfDays = 1;

      if (_.startsWith(match.matchType, 'Multi Day')) {
        noOfDays = parseInt(match.matchType.match(/\d/)[0]);
      } else if (match.matchType.toLowerCase() == 'test') {
        noOfDays = 5;
      }

      var endDate = moment(match.matchDate).add(noOfDays, 'days').endOf('date').add(2, 'days');
      if (startDate <= today && today <= endDate) {
        console.debug('adding live match', match);
        var liveMatch = { id: match.matchId.name, status: match.matchState, desc: team1 + ' vs ' + team2 };

        if (isIntMatch) {
          liveMatch.url = URL.INT_LIVE.replace('seriesId', seriesId).replace('matchId', match.matchId.name);
        } else {
          liveMatch.url = URL.DOM_LIVE.replace('seriesId', seriesId).replace('matchId', match.matchId.name);
        }

        if (match.matchStatus) {
          liveMatch.result = {
            code: match.matchStatus.outcome,
            text: match.matchStatus.text
          };
        }

        live.push(liveMatch);
        console.log('LIVE: ', liveMatch);
      }
    });
  }

  function onSeriesDetailsLoad(detail) {
    detail = detail.replace('onMatchSchedule(', '').replace(');', '');
    detail = JSON.parse(detail);
    console.debug('loading details', detail.tournamentId.tournamentLabel);

    chrome.storage.sync.get('series', data => {
      var series = data.series;
      var toEdit = _.findIndex(series, {name: detail.tournamentId.name});

      if (toEdit !== -1) {
        var start = moment(detail.schedule[0].matchDate);
        var end = moment(_.last(detail.schedule).matchDate);
        var today = moment();

        series[toEdit].label = detail.tournamentId.tournamentLabel || _.startCase(detail.tournamentId.name);
        series[toEdit].id = detail.tournamentId.id;
        series[toEdit].start = start.format('MMM Do');
        series[toEdit].end = end.format('MMM Do');
        if (start > today || today > end) {
          series[toEdit].active = false;
        } else {
          series[toEdit].active = true;
          _.forEach(detail.schedule, d => {
            var team1 = null;
            var team2 = null;

            if (d.team1.team.fullName != 'TBD') {
              var team1 = { series: series[toEdit].label, int: series[toEdit].int,
                  name: d.team1.team.fullName, abbr: d.team1.team.abbreviation };

              if (_.findIndex(teams, team1) === -1) {
                teams.push(team1);
              }
            }

            if (d.team2.team.fullName != 'TBD') {
              var team2 = { series: series[toEdit].label, int: series[toEdit].int,
                  name: d.team2.team.fullName, abbr: d.team2.team.abbreviation };

              if (_.findIndex(teams, team2) === -1) {
                teams.push(team2);
              }
            }
          });

          populateLiveMatches(detail.schedule, series[toEdit].name, series[toEdit].int);
        }

        chrome.storage.sync.set({series: series});
      }

      getSeriesDetails();

    });
  }

  function getSeriesDetails() {
    if (series.length === 0) {
      if (teams.length !== 0) {
        chrome.storage.sync.set({teams: _.sortBy(_.compact(teams), 'name')});
        chrome.storage.sync.set({live: live}, () => {
          setUpAlarms();
          getLiveScores();
        });

        if (live.length > 0) {
          chrome.browserAction.setBadgeText({text: 'live'});
        }

        if (port) {
          port.postMessage('reload-view');
        }
      }

      return;
    }

    var s = series.pop();
    var url = s.url;
    xhrGET(url, onSeriesDetailsLoad);
  }

  function onSeriesLoad(homePage) {
    var div = document.createElement('div');
    div.innerHTML = homePage;
    series = [];

    var intSeries = div.querySelector('[data-season]').getAttribute('data-season').split(', ');
    intSeries.forEach(s => {
      series.push( { name: s, url: URL.INT_SCHEDULE.replace('seriesId', s), int: true });
    });

    var domSeries =  div.querySelector('[data-tab="domestic"]').getAttribute('data-int-other-season');
    domSeries += ', ' + div.querySelector('[data-tab="domestic"]').getAttribute('data-dom-season');
    domSeries = domSeries.split(', ');

    domSeries.forEach(s => {
      series.push( { name: s, url: URL.SCHEDULE.replace('seriesId', s)});
    });

    chrome.storage.sync.set({
      series: series
    });

    chrome.storage.sync.get('favTeams', data => {
      favTeams = data.favTeams || [];
      getSeriesDetails(series);
    });
  }

  function getSeries() {
    xhrGET(URL.INDEX, onSeriesLoad);
  }

  function init() {
    series = [];
    teams = [];
    live = [];
    favTeams = [];
    chrome.alarms.clearAll(getSeries);
  }

  chrome.runtime.onInstalled.addListener(details => {
    console.log('previousVersion', details.previousVersion);
    init();
  });

  chrome.runtime.onConnect.addListener(p => {
    port = p;
    console.log('connected to popup...');
    port.onMessage.addListener(msg => {
      console.log('got msg', msg);
      if (msg === 'reload-db') {
        init();
      }
    });
    port.onDisconnect.addListener(() => {
      console.log('disconnected from popup...');
      port = null;
    });
  });


})();
