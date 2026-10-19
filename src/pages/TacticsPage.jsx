import React from 'react';
import source from '../../public/tactica/index.html?raw';
import { bodyMarkup } from '../lib/legacyMarkup.js';
import { LegacyPage } from '../components/LegacyPage.jsx';

const markup = bodyMarkup(source);
const load = () => import('../../public/tactica.js');
export default function TacticsPage() { return <LegacyPage page="tactica" markup={markup} loadController={load}/>; }
