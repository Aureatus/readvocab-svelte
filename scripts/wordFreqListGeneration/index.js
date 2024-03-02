import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import pkg from 'he';
import WordPOS from 'wordpos';
const { decode } = pkg;

/* 
PART OF SPEECH DESCRIPTIONS
FOUND FROM PAGE 13 OF THE `Word Frequencies in Written and Spoken English: based on the British National Corpus.` BOOK
Adj - adjective (e.g. good, old, fine, early, regional)
Adv - adverb (e.g. nOlV, lvell, suddenly, early, further)
ClO - clause opener (in order [that/to], so as [to]) 16
Conj - conjunction (e.g. and, but, if, because, so that)
Det - determiner (e.g. a, an, every, no, the)
DetP - determiner/pronoun (e.g. this, these, those, some, all) 17
Ex - existential particle (there in there is, there are, etc.)
Fore - foreign ,vord (e.g. de, du, la)
Form - formula (e.g. 2x+z)
Gen - genitive ('s, ')18
Inf - infinitive marker (to)
Int - interjection or discourse marker (e.g. oh, aha, oops, yep, no)
Lett - letter of the alphabet, treated as a word (e.g. p, P, Q, r, z)
Neg - negative marker (not, ,-.;n't)
NoC - common noun (e.g. lvealth, lvalls, child, times, mission)
NoP - proper noun (e.g. Malaysia, Paris, Susan, Roberts, Tuesday)
NoP- word which is normally part of a proper noun (e.g. San in San Diego)
Num - (cardinal) number (e.g. one, four, forty, viii, 8, 55, 1969)
Ord - ordinal (e.g. first, 1st, 9th, twenty-first, next, last)
Prep - preposition (e.g. of, in, without, up to, in charge oj)
Pron - pronoun (e.g. I, you, she, him, theirs, none, something)
Verb - verb-excluding modal auxiliaries (e.g. tell, find, increase, realize)
Vmod - modal auxiliary verb (e.g. can, will, would, could, may, must, should)

WAS NOT INCLUDED WHERE I READ THIS, BUT `uncl` IS ALSO A PART OF SPEECH THAT IS PRESENT, ASSUMING IT STANDS FOR UNCLASSIFIED
*/

// This is all of the part of speeches present in the file, there *is* "Err" BUT those are errors so we don't include them.
const allPartsOfSpeech = [
	'Uncl',
	'DetP',
	'Fore',
	'NoP',
	'Adj',
	'Det',
	'Inf',
	'Lett',
	'NoC',
	'Prep',
	'Pron',
	'Int',
	'Verb',
	'Adv',
	'Conj',
	'Form',
	'Num',
	'VMod',
	'Ex',
	'ClO',
	'Neg',
	'Gen'
];

const disallowedPartsOfSpeech = [
	'Num',
	'Ord',
	'NoP-',
	'Neg',
	'Lett',
	'Int',
	'Inf',
	'Form',
	'Fore',
	'Ex',
	'Det',
	'DetP',
	'Conj',
	'ClO',
	'Uncl',
	'Prep',
	'Gen',
	'NoP',
	'Pron'
];

const allowedPartsOfSpeech = allPartsOfSpeech.filter((e) => !disallowedPartsOfSpeech.includes(e));
const corpusPosToWordnetPosMapping = {
	NoC: 'noun',
	NoP: 'noun',
	Pron: 'noun',
	Verb: 'verb',
	Adj: 'adjective',
	Adv: 'adverb',
	VMod: 'adverb'
};

const htmlDecodedFile = decode(
	readFileSync(`${import.meta.dirname}/1_1_all_fullalpha.csv`, 'utf-8')
);
const records = parse(htmlDecodedFile, { delimiter: '\t' });

// Different word forms (plurals etc) use @ as a placeholder to keep the tab delimitation valid, don't use these at the moment - may in the future?
const relevantRecords = records.filter((e) => !e.includes('@'));
// Map array to word object, filter out disallowed parts of speech, sort in order of (freq + disp + ra) and map all parts of speech to standard grammatical classes.
const wordObjectArray = relevantRecords
	.map((e) => ({
		word: e[1],
		pos: e[2],
		freq: parseInt(e[4]),
		disp: parseFloat(e[6]),
		ra: parseInt(e[5])
	}))
	.filter((e) => allowedPartsOfSpeech.includes(e.pos))
	.sort((a, b) => a.freq - b.freq || a.disp - b.disp || a.ra - b.ra)
	.map((e) => ({ ...e, pos: corpusPosToWordnetPosMapping[e.pos] }));

const wordSearch = new WordPOS();
/*
Possible pos are:
s - adjective satellite
n - noun
r - adverb
a - adjective
v - verb
*/

const getWordDefinition = async ({ pos, word }) => {
	const info = await (async () => {
		switch (pos) {
			case 'noun':
				return await wordSearch.lookupNoun(word);
			case 'adjective':
				return await wordSearch.lookupAdjective(word);
			case 'verb':
				return await wordSearch.lookupVerb(word);
			case 'adverb':
				return await wordSearch.lookupAdverb(word);
			default:
				return null;
		}
	})();
	const definition = info?.[0]?.def;
	return definition ? definition.trim() : null;
};

const wordObjectsWithDefs = (
	await Promise.all(
		wordObjectArray.map(async (word) => {
			const definition = await getWordDefinition({ pos: word.pos, word: word.word });
			if (!definition) return null;
			const newWord = { ...word, definition };
			return newWord;
		})
	)
).filter(Boolean);

writeFileSync(
	`${import.meta.dirname}/wordFreqList.json`,
	JSON.stringify(wordObjectsWithDefs, null, 2)
);
