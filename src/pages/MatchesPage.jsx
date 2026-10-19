import React from 'react';
import source from '../../public/jdm/index.html?raw';
import { bodyMarkup } from '../lib/legacyMarkup.js';
import { LegacyPage } from '../components/LegacyPage.jsx';

const markup = bodyMarkup(source);
const load = () => import('../../public/jdm.js');
export default function MatchesPage() { return <LegacyPage page="jdm" markup={markup} loadController={load}/>; }
