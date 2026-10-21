// The official fixture id is the only relationship exposed by the existing API.
export function goalsForMatch(goals, matchId) {
  return goals.filter(goal => goal.match_id === matchId).sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity));
}
