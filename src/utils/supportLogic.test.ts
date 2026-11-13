import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAgentActionDecision,
  detectSelfHarmIntent,
  evaluateEpdsResponses,
  getHomeWelcomeContent,
  getProactiveCompanionOpening,
  getTimePeriod,
  matchGroupsForOnboardingGoals,
  toggleGoalSelection,
} from './supportLogic';
import { CRISIS_RESOURCES, INITIAL_APP_STATE } from '../data/demoData';

test('Crisis resources follow exact 5-tier order and remove old wrong hotline mapping', () => {
  assert.equal(CRISIS_RESOURCES.length, 5);
  assert.equal(CRISIS_RESOURCES[0].exactLine, '1. In danger now: 911');
  assert.equal(
    CRISIS_RESOURCES[1].exactLine,
    '2. In crisis: call or text 988 — Suicide and Crisis Lifeline, free, confidential, 24/7.'
  );
  assert.equal(
    CRISIS_RESOURCES[2].exactLine,
    '3. Need to talk, anytime: National Maternal Mental Health Hotline — call or text 1-833-TLC-MAMA (1-833-852-6262), 24/7, English and Spanish.'
  );
  assert.equal(
    CRISIS_RESOURCES[3].exactLine,
    '4. Want support and referrals: PSI HelpLine — 1-800-944-4773 (warm line, callback).'
  );
  assert.equal(
    CRISIS_RESOURCES[4].exactLine,
    '5. Treatment referrals: Substance Abuse and Mental Health Services Administration (SAMHSA) — call 1-800-662-HELP (4357) for treatment referrals.'
  );
});

test('getTimePeriod and getHomeWelcomeContent show Up for a feed in 12am-6am slot with Cant sleep Talk to her CTA', () => {
  assert.equal(getTimePeriod(0), 'late_night');
  assert.equal(getTimePeriod(3), 'late_night');
  assert.equal(getTimePeriod(5), 'late_night');
  assert.equal(getTimePeriod(8), 'morning');
  assert.equal(getTimePeriod(13), 'afternoon');
  assert.equal(getTimePeriod(21), 'evening');

  const lateWelcome = getHomeWelcomeContent(2, 'Maya');
  assert.equal(lateWelcome.greeting, 'Up for a feed?');
  assert.equal(lateWelcome.ctaLabel, "Can't sleep? Talk to Nia");
  assert.equal(lateWelcome.isLateNight, true);

  const morningWelcome = getHomeWelcomeContent(9, 'Maya');
  assert.equal(morningWelcome.greeting, 'Good morning, Maya');
  assert.equal(morningWelcome.isLateNight, false);
});

test('getProactiveCompanionOpening starts with Cant sleep Im here between 12am and 6am', () => {
  const lateMsg = getProactiveCompanionOpening(1, 'Maya', 'Leo');
  assert.equal(lateMsg.windowTag, 'late_night');
  assert.ok(lateMsg.text.startsWith("Can't sleep? I'm here."));
});

test('detectSelfHarmIntent catches crisis phrases without false-flagging normal postpartum fatigue', () => {
  assert.equal(detectSelfHarmIntent('I want to hurt myself tonight'), true);
  assert.equal(detectSelfHarmIntent('I feel like hurting myself tonight'), true);
  assert.equal(detectSelfHarmIntent('thinking about ending my life'), true);
  assert.equal(detectSelfHarmIntent('feeling suicidal right now'), true);

  assert.equal(detectSelfHarmIntent('I am so tired from night feedings with Leo'), false);
  assert.equal(detectSelfHarmIntent('Feeling overwhelmed with laundry today'), false);
});

test('evaluateEpdsResponses flags elevated scores and self-harm item with non-diagnostic language and tiered escalation', () => {
  const lowResult = evaluateEpdsResponses([0, 0, 1, 1, 0, 1, 0, 1, 0, 0]);
  assert.equal(lowResult.totalScore, 4);
  assert.equal(lowResult.flagged, false);
  assert.equal(lowResult.urgentCrisisEscalation, false);

  const elevatedResult = evaluateEpdsResponses([2, 2, 2, 2, 1, 2, 1, 1, 1, 0]);
  assert.equal(elevatedResult.totalScore, 14);
  assert.equal(elevatedResult.flagged, true);
  assert.equal(elevatedResult.urgentCrisisEscalation, false);
  assert.ok(elevatedResult.summaryMessage.includes('never a formal diagnosis'));

  const item10Positive = evaluateEpdsResponses([0, 0, 1, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(item10Positive.flagged, true);
  assert.equal(item10Positive.urgentCrisisEscalation, true);
  assert.deepEqual(item10Positive.recommendedTierIds.slice(0, 2), ['tier-911', 'tier-988']);
});

test('Onboarding goal selection enforces max 2 goals and matches tailored groups', () => {
  let goals = toggleGoalSelection([], 'Sleep');
  goals = toggleGoalSelection(goals, 'Finding my people');
  goals = toggleGoalSelection(goals, 'Feeding');
  assert.equal(goals.length, 2);
  assert.deepEqual(goals, ['Finding my people', 'Feeding']);

  const matchedIds = matchGroupsForOnboardingGoals(INITIAL_APP_STATE.groups, goals);
  assert.ok(matchedIds.length >= 1 && matchedIds.length <= 3);
});

test('applyAgentActionDecision updates groups, posts, favorite hospital, Uber ride, and calendar events', () => {
  const afterJoin = applyAgentActionDecision(INITIAL_APP_STATE, 'act-join-group', 'accepted');
  const firstTimeGroup = afterJoin.groups.find((g) => g.id === 'grp-first-time');
  assert.equal(firstTimeGroup?.joined, true);
  assert.equal(firstTimeGroup?.memberCount, 149);

  const afterFav = applyAgentActionDecision(afterJoin, 'act-fav-hospital', 'accepted');
  assert.equal(afterFav.profile.favoriteHospitalId, 'hosp-willow-creek');

  const afterUber = applyAgentActionDecision(afterFav, 'act-book-uber', 'accepted');
  assert.equal(afterUber.uberDraft.status, 'accepted');
  assert.ok(afterUber.calendarEvents.some((ev) => ev.id === 'cal-uber-tue-10am'));
});
