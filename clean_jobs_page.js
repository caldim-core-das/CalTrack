const fs = require('fs');
let content = fs.readFileSync('frontend/src/ui/pages/EmployeeJobsPage.jsx', 'utf-8');

// Remove performance state
content = content.replace(/const \[performance, setPerformance\] = useState\(null\)\n?/g, '');
content = content.replace(/const \[perfLoading, setPerfLoading\] = useState\(true\)\n?/g, '');
content = content.replace(/const \[activeTab, setActiveTab\] = useState\("active"\).*/, 'const [activeTab, setActiveTab] = useState("active") // active | history');

// Remove loadPerformance function and its call
content = content.replace(/\/\* ── Load Performance ── \*\/[\s\S]*?finally \{ setPerfLoading\(false\) \}\n  \}\n/g, '');
content = content.replace(/useEffect\(\(\) => \{ loadJobs\(\); loadPerformance\(\) \}, \[\]\)/g, 'useEffect(() => { loadJobs() }, [])');
content = content.replace(/if \(action === "complete"\) loadPerformance\(\)/g, 'if (action === "complete") loadJobs()');

// Remove loadPerformance from refresh button
content = content.replace(/onClick=\{\(\) => \{ loadJobs\(\); loadPerformance\(\) \}\}/g, 'onClick={() => { loadJobs() }}');

// Remove Performance tab button
content = content.replace(/<button className=\{`ej-tab \$\{activeTab === "performance" \? "ej-tab--active" : ""`\} onClick=\{\(\) => setActiveTab\("performance"\)\}>\s*<BarChart3 size=\{14\} \/> Performance\s*<\/button>/g, '');

// Remove Performance tab content
content = content.replace(/\{\/\* ── Performance Tab ── \*\/\}\s*\{activeTab === "performance" && \([\s\S]*?(?=\{\/\* Modals \*\/\})/g, '');

// Also fix the weird extra </button> and )} if they exist
content = content.replace(/<\/button>\s*<\/button>\s*<\/div>/g, '</button>\n      </div>');
content = content.replace(/\)\}\s*\)\}\s*<\/AnimatePresence>/g, ')}\n        </AnimatePresence>');

fs.writeFileSync('frontend/src/ui/pages/EmployeeJobsPage.jsx', content);
console.log('EmployeeJobsPage updated.');
