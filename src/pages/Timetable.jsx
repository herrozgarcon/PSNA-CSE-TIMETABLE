import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { generateClassTimetable } from '../utils/TimetableGenerator';

const TimetablePage = () => {
    const { classes, teachers, subjects, schedule, setSchedule } = useData();
    const [selectedSemester, setSelectedSemester] = useState('');
    const [activeTab, setActiveTab] = useState('A');
    const [viewMode, setViewMode] = useState('editor'); // 'editor' or 'print'

    const handleGenerate = () => {
        // Wrapper not needed if button is in child, but good for future hoisting
    };

    return (
        <div style={{ padding: '0 0 2rem 0' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Timetable Management</h1>
                    <p style={{ color: 'var(--text-light)' }}>Create and manage weekly schedules.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        className="input-field"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        style={{ minWidth: '180px' }}
                    >
                        <option value="">Select Semester...</option>
                        {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                        ))}
                    </select>

                    <button
                        className={`btn ${viewMode === 'print' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setViewMode(viewMode === 'editor' ? 'print' : 'editor')}
                    >
                        {viewMode === 'editor' ? 'Print View' : 'Editor View'}
                    </button>
                </div>
            </div>

            {!selectedSemester ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                    <p style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>Please select a Semester to view the timetable.</p>
                </div>
            ) : (
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                    {/* Section Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                        {['A', 'B', 'C', 'D'].map(section => (
                            <button
                                key={section}
                                onClick={() => setActiveTab(section)}
                                style={{
                                    padding: '1rem 2rem',
                                    fontWeight: '600',
                                    color: activeTab === section ? 'var(--primary)' : 'var(--text-light)',
                                    borderBottom: activeTab === section ? '2px solid var(--primary)' : 'none',
                                    background: activeTab === section ? '#fff' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Section {section}
                            </button>
                        ))}
                    </div>

                    {/* View Content */}
                    {viewMode === 'editor' ? (
                        <TimetableEditor
                            selectedSemester={selectedSemester}
                            activeSection={activeTab}
                            schedule={schedule}
                            setSchedule={setSchedule} // Pass global setter
                        />
                    ) : (
                        <PrintView
                            selectedSemester={selectedSemester}
                            activeSection={activeTab}
                            schedule={schedule}
                            subjects={subjects}
                            teachers={teachers}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const TimetableEditor = ({ selectedSemester, activeSection, schedule, setSchedule }) => {
    // Destructure updateTeachers to persist assignments
    const { subjects, teachers, updateTeachers } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedAlternatives, setSelectedAlternatives] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const times = [
        '08:45 - 09:40', '09:40 - 10:35', '10:55 - 11:45',
        '11:45 - 12:35', '01:35 - 02:25', '02:25 - 03:15', '03:15 - 04:10'
    ];

    const getCellKey = (day, time) => `Sem${selectedSemester}-S${activeSection}-${day}-${time}`;

    const handleCellClick = (day, time) => {
        setSelectedCell({ day, time });
        const key = getCellKey(day, time);
        const data = schedule[key];
        setSelectedSubject(data ? data.subject : '');
        setSelectedAlternatives(data?.alternatives || []);
        setSelectedRoom(data ? data.room : '');
        setIsModalOpen(true);
    };

    const handleSaveCell = () => {
        if (selectedCell) {
            const key = getCellKey(selectedCell.day, selectedCell.time);
            const newSchedule = { ...schedule };

            if (selectedSubject) {
                const sub = subjects.find(s => s.code === selectedSubject.split(' - ')[0]) || { name: selectedSubject, code: 'MANUAL' };
                newSchedule[key] = {
                    ...sub,
                    subject: selectedSubject,
                    alternatives: selectedAlternatives.filter(a => a), // only saved filled ones
                    room: selectedRoom
                };
            } else {
                delete newSchedule[key];
            }

            setSchedule(newSchedule);
        }
        setIsModalOpen(false);
    };

    // --- Auto Generator ---
    const generateSchedule = () => {
        // 1. Identify relevant subjects for this Class (Semester X - Section Y)
        const currentSectionLabel = `Section ${activeSection}`;
        const currentClassId = `Sem ${selectedSemester} - ${currentSectionLabel}`;

        let classTeachers = teachers.filter(t =>
            t.assignedClass === currentSectionLabel &&
            t.semester === selectedSemester
        );
        let usedAllSubjects = false;

        // --- FALLBACK LOGIC ---
        if (classTeachers.length === 0) {
            const unassignedTeachers = teachers.filter(t => !t.assignedClass || t.assignedClass === '-' || t.assignedClass === 'None' || t.assignedClass === '');
            if (unassignedTeachers.length > 0) {
                if (window.confirm(`No teachers explicitly assigned to ${currentClassLabel}.\n\nFound ${unassignedTeachers.length} unassigned teachers. Do you want to use them for this timetable?`)) {
                    classTeachers = unassignedTeachers;
                    // Persist assignment to these teachers
                    if (updateTeachers) {
                        updateTeachers(unassignedTeachers.map(t => ({ ...t, assignedClass: currentClassLabel })));
                    }
                }
            }
        }

        if (classTeachers.length === 0) {
            const confirmTest = window.confirm(
                `No teachers found. Generate a sample timetable using ALL available subjects instead? \n(This is useful for testing without assigning teachers first)`
            );
            if (!confirmTest) return;
            usedAllSubjects = true;
        }

        // 2. Prepare Assignments List for Generator
        let assignments = [];

        if (usedAllSubjects) {
            const subToUse = subjects.slice(0, 8);
            assignments = subToUse.map(s => ({
                subject: { ...s, id: s.id || s.code },
                teacher: { id: 'simulate', name: 'TBD' },
                periodsPerWeek: parseInt(s.periodsPerWeek) || 4,
                type: s.type,
                isIntegrated: s.isIntegrated
            }));
        } else {
            classTeachers.forEach(t => {
                const extractCode = (str) => {
                    if (!str) return '';
                    const s = String(str);
                    const parts = s.split(' - ');
                    return parts.length > 0 ? parts[0].trim() : s.trim();
                };
                const teacherSubjectCode = extractCode(t.subject);

                // Safe Find with String conversion
                const subjectData = subjects.find(s =>
                    (s.code && String(s.code) === teacherSubjectCode) ||
                    (s.name && String(s.name) === String(t.subject)) ||
                    (t.subject && s.name && String(t.subject).includes(String(s.name)))
                );

                if (subjectData) {
                    assignments.push({
                        subject: { ...subjectData, id: subjectData.id },
                        teacher: { id: t.id, name: t.name },
                        periodsPerWeek: parseInt(subjectData.periodsPerWeek) || 4,
                        type: subjectData.type,
                        isIntegrated: subjectData.isIntegrated
                    });
                }
            });
        }

        if (assignments.length === 0) {
            alert('No valid assignments found to generate.');
            return;
        }

        // 3. Call Generator
        // Clean current class from schedule first so it doesn't clash with its own old slots
        const cleanedSchedule = { ...schedule };
        Object.keys(cleanedSchedule).forEach(k => {
            if (k.startsWith(`Sem${selectedSemester}-S${activeSection}-`)) {
                delete cleanedSchedule[k];
            }
        });

        const { schedule: newClassSchedule, errors } = generateClassTimetable(
            currentClassId,
            assignments,
            cleanedSchedule
        );

        if (errors.length > 0) {
            console.warn("Generation Warnings:", errors);
        }

        // 4. Merge
        const finalMerged = { ...cleanedSchedule, ...newClassSchedule };
        setSchedule(finalMerged);
    };

    return (
        <div className="p-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary" onClick={generateSchedule} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    Auto-Generate Sem {selectedSemester}-{activeSection}
                </button>
            </div>

            <div className="table-container" style={{ overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>Day</th>
                            {times.map(t => (
                                <th key={t} style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: '600', minWidth: '120px' }}>
                                    {t}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {days.map(day => (
                            <tr key={day} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '1rem', fontWeight: '500', color: '#334155', background: '#fff' }}>{day}</td>
                                {times.map(time => {
                                    const key = getCellKey(day, time);
                                    const cellData = schedule[key];
                                    return (
                                        <td
                                            key={time}
                                            onClick={() => handleCellClick(day, time)}
                                            style={{
                                                padding: '0.5rem',
                                                borderLeft: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                background: cellData ? (cellData.type === 'Lab' ? '#eff6ff' : '#fff') : '#fff',
                                                transition: 'all 0.2s'
                                            }}
                                            className="hover:bg-slate-50"
                                        >
                                            {cellData ? (
                                                <div style={{ fontSize: '0.875rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                        <div style={{ fontWeight: '600', color: cellData.type === 'Lab' ? '#2563eb' : '#0f172a' }}>
                                                            {cellData.code}
                                                        </div>
                                                        {cellData.alternatives && cellData.alternatives.map((alt, idx) => {
                                                            const altCode = typeof alt === 'object' ? alt.code : alt.split(' - ')[0];
                                                            return (
                                                                <React.Fragment key={idx}>
                                                                    <div style={{ width: '1px', height: '14px', background: '#cbd5e1' }}></div>
                                                                    <div style={{ fontWeight: '600', color: '#6366f1', fontSize: '0.8rem' }}>
                                                                        {altCode}
                                                                    </div>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                        {[
                                                            cellData.name,
                                                            ...(cellData.alternatives || []).map(a => typeof a === 'object' ? a.name : a.split(' - ')[1])
                                                        ].filter(Boolean).join(' | ')}
                                                    </div>
                                                    {cellData.room && (
                                                        <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '500', marginTop: '2px', background: '#ecfdf5', padding: '0 4px', borderRadius: '4px', display: 'inline-block' }}>
                                                            {cellData.room}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                                    +
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Debug Info Panel */}
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Debug Info</p>
                <p>Selected Target: Semester {selectedSemester} - Section {activeSection}</p>
                <p>Teachers Assigned: {teachers.filter(t => t.assignedClass === `Section ${activeSection}` && t.semester === selectedSemester).length}</p>
                <p>Unassigned Teachers: {teachers.filter(t => !t.assignedClass || t.assignedClass === '-').length}</p>
            </div>

            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Edit Slot</h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Subject</label>
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            >
                                <option value="">(Free Period)</option>
                                {subjects.map(s => (
                                    <option key={s.id} value={`${s.code} - ${s.name}`}>
                                        {s.code} - {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <label style={{ fontWeight: '600', color: '#475569' }}>Alternative Subjects</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Count:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="5"
                                        value={selectedAlternatives.length}
                                        onChange={(e) => {
                                            const count = parseInt(e.target.value) || 0;
                                            const newAlts = [...selectedAlternatives];
                                            if (count > newAlts.length) {
                                                const diff = count - newAlts.length;
                                                for (let i = 0; i < diff; i++) newAlts.push('');
                                            } else {
                                                newAlts.length = Math.max(0, count);
                                            }
                                            setSelectedAlternatives(newAlts);
                                        }}
                                        style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                    />
                                    <button
                                        className="btn btn-outline"
                                        style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                                        onClick={() => setSelectedAlternatives([...selectedAlternatives, ''])}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {selectedAlternatives.map((alt, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <select
                                        value={alt}
                                        onChange={(e) => {
                                            const newAlts = [...selectedAlternatives];
                                            newAlts[idx] = e.target.value;
                                            setSelectedAlternatives(newAlts);
                                        }}
                                        style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    >
                                        <option value="">(Select Subject)</option>
                                        {subjects.map(s => (
                                            <option key={s.id} value={`${s.code} - ${s.name}`}>
                                                {s.code} - {s.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setSelectedAlternatives(selectedAlternatives.filter((_, i) => i !== idx))}
                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Room / Venue (Optional)</label>
                            <input
                                type="text"
                                value={selectedRoom}
                                onChange={(e) => setSelectedRoom(e.target.value)}
                                placeholder="e.g. Seminar Hall, CS Lab 1"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>Cancel</button>
                            <button onClick={handleSaveCell} className="btn btn-primary">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Print View Sub-Component
const PrintView = ({ selectedSemester, activeSection, schedule, subjects, teachers }) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const times = [
        '08:45 - 09:40', '09:40 - 10:35', '10:55 - 11:45',
        '11:45 - 12:35', '01:35 - 02:25', '02:25 - 03:15', '03:15 - 04:10'
    ];
    const getCellKey = (day, time) => `Sem${selectedSemester}-S${activeSection}-${day}-${time}`;

    return (
        <div style={{ padding: '2rem', background: 'white' }} id="print-area">
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                TIMETABLE - SEMESTER {selectedSemester} / SEC {activeSection}
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black' }}>
                <thead>
                    <tr>
                        <th style={{ border: '1px solid black', padding: '8px' }}>Day \ Time</th>
                        {times.map(t => <th key={t} style={{ border: '1px solid black', padding: '8px', fontSize: '12px' }}>{t}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {days.map(day => (
                        <tr key={day}>
                            <td style={{ border: '1px solid black', padding: '8px', fontWeight: 'bold' }}>{day}</td>
                            {times.map(time => {
                                const cell = schedule[getCellKey(day, time)];
                                return (
                                    <td key={time} style={{ border: '1px solid black', padding: '8px', textAlign: 'center', height: '60px' }}>
                                        {cell ? (
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>
                                                    {cell.code}
                                                    {cell.alternatives && cell.alternatives.map((alt, i) => {
                                                        const altCode = typeof alt === 'object' ? alt.code : alt.split(' - ')[0];
                                                        return ` | ${altCode}`;
                                                    })}
                                                </div>
                                                <div style={{ fontSize: '12px' }}>
                                                    {cell.name}
                                                    {cell.alternatives && cell.alternatives.map((alt, i) => {
                                                        const altName = typeof alt === 'object' ? alt.name : alt.split(' - ')[1];
                                                        return ` | ${altName}`;
                                                    })}
                                                </div>
                                                {cell.room && <div style={{ fontSize: '11px', color: '#666' }}>({cell.room})</div>}
                                            </div>
                                        ) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TimetablePage;
