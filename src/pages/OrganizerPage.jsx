import React from 'react';
import source from '../../public/organizador/index.html?raw';
import { bodyMarkup } from '../lib/legacyMarkup.js';
import { LegacyPage } from '../components/LegacyPage.jsx';

const markup = bodyMarkup(source);
const load = () => import('../../public/app.js');
export default function OrganizerPage() { return <LegacyPage page="organizador" markup={markup} loadController={load}/>; }
