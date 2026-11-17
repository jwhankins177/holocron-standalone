import {createRoot} from 'react-dom/client';
import App from './modern/App';
import './modern/styles.css';
import './modern/tuning.css';
import './modern/palettes.css';
import './modern/navigation.css';
import './modern/game-tracker.css';
import './modern/interface-cleanup.css';
import './modern/insights.css';
import './modern/play-records.css';
import './modern/polish.css';

createRoot(document.getElementById('root')!).render(<App/>);
