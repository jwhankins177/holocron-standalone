import test from 'node:test';
import assert from 'node:assert/strict';
import {homePageOptions,normalizeHomePage} from '../modern/lib/home-page.ts';

test('saved home page choices are recognized',()=>{
 for(const option of homePageOptions)assert.equal(normalizeHomePage(option.value),option.value);
});

test('unsupported saved home pages fall back to the card catalog',()=>{
 assert.equal(normalizeHomePage(null),'catalog');
 assert.equal(normalizeHomePage('unknown'),'catalog');
});
