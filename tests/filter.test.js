import { isSubstantiveTweet, removeEmoji, isPolitenessOnly, hasLink } from '../.claude/skills/follow-builders-local/scripts/fetch-and-save.js';

// Test emoji removal
console.assert(removeEmoji('Hello 👋 world 🌍') === 'Hello  world ', 'Emoji removal failed');

// Test politeness detection
console.assert(isPolitenessOnly('thanks'), '"thanks" should be politeness');
console.assert(isPolitenessOnly('Great!'), '"Great!" should be politeness');
console.assert(!isPolitenessOnly('Great article about AI'), 'Should not filter substantive content');

// Test substantive detection
console.assert(!isSubstantiveTweet({ text: 'thanks' }), 'Short politeness should be filtered');
console.assert(!isSubstantiveTweet({ text: '👍' }), 'Pure emoji should be filtered');
console.assert(isSubstantiveTweet({ text: 'New model released with significant improvements https://example.com' }), 'Substantive tweet should pass');

console.log('All filter tests passed!');
