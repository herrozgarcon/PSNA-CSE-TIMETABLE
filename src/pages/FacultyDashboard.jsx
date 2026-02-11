import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Calendar, Layers, Printer } from 'lucide-react';
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const FacultyDashboard = ({ facultyName }) => {
    const { schedule, department, timeSlots } = useData();
    const teachingSlotsCount = useMemo(() => {
        if (!timeSlots) return 7;
        return timeSlots.filter(s => s.type !== 'break').length;
    }, [timeSlots]);
    const mySchedule = useMemo(() => {
        const grid = Array(6).fill(null).map(() => Array(teachingSlotsCount).fill(null));
        const cleanName = facultyName.toLowerCase().replace(/^(dr\.|mr\.|mrs\.|ms\.)\s*/i, '').replace(/[^a-z0-9]/g, '');
        if (!schedule) return grid;
        Object.entries(schedule).forEach(([semester, sections]) => {
            if (!sections || typeof sections !== 'object') return;
            Object.entries(sections).forEach(([section, days]) => {
                if (!days || !Array.isArray(days)) return;
                days.forEach((dayRow, dayIdx) => {
                    dayRow.forEach((cell, periodIdx) => {
                        if (periodIdx >= teachingSlotsCount) return;
                        if (!cell) return;
                        let isMyClass = false;
                        // Check if I am one of the teachers
                        const normalize = (name) => String(name).toLowerCase().replace(/^(dr\.|mr\.|mrs\.|ms\.)\s*/i, '').replace(/[^a-z0-9]/g, '');

                        const rawTeacherName = cell.teacherName || '';
                        const teachersFromCell = [
                            ...(cell.allTeachers || []),
                            ...(String(rawTeacherName).split('/').map(t => t.trim()))
                        ].filter(Boolean);

                        const isMatch = (name) => {
                            if (!name) return false;
                            const normalized = normalize(name);
                            return normalized === cleanName || normalized.includes(cleanName) || cleanName.includes(normalized);
                        };

                        if (teachersFromCell.some(isMatch)) {
                            isMyClass = true;
                        }
                        if (isMyClass) {
                            const classInfo = {
                                ...cell,
                                semester,
                                section,
                                displayCode: cell.type === 'ELECTIVE_GROUP' ? 'ELECTIVE' : cell.code
                            };
                            grid[dayIdx][periodIdx] = classInfo;
                        }
                    });
                });
            });
        });
        return grid;
    }, [schedule, facultyName, teachingSlotsCount]);
    const formatTime = (t) => {
        if (!t) return '';
        const [h, m] = t.split(':');
        const hr = parseInt(h, 10);
        const amp = hr >= 12 ? 'PM' : 'AM';
        const hr12 = hr % 12 || 12;
        return `${hr12}:${m}`;
    };
    return (
        <div className="timetable-container">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
                .timetable-container {
                    font-family: 'Outfit', sans-serif;
                    padding: 1.5rem;
                    background: #f1f5f9;
                    min-height: 100vh;
                }
                @media screen {
                    .screen-only { display: block; }
                    .print-only { display: none !important; }
                    .dashboard-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #1e293b;
                        padding: 1.5rem 2rem;
                        border-radius: 16px;
                        color: white;
                        margin-bottom: 2rem;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    }
                    .control-group {
                        display: flex;
                        gap: 1rem;
                        align-items: center;
                    }
                    .btn-premium {
                        padding: 0.6rem 1.5rem;
                        border-radius: 10px;
                        font-weight: 800;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                        cursor: pointer;
                        border: none;
                    }
                    .btn-print { background: white; color: #1e293b; }
                    .btn-print:hover { background: #f8fafc; transform: translateY(-2px); }
                    .timetable-glass-card {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                        overflow-x: auto;
                    }
                    .main-grid {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        min-width: 800px;
                    }
                    .main-grid th {
                        padding: 1.2rem 0.5rem;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 0.7rem;
                        font-weight: 600;
                        text-align: center;
                        border-bottom: 1px solid #e2e8f0;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        min-width: 80px;
                    }
                    .main-grid td {
                        padding: 8px;
                        border-bottom: 1px solid #f1f5f9;
                        vertical-align: middle;
                        text-align: center;
                    }
                    .day-column {
                        background: #fff;
                        color: #1e293b;
                        font-weight: 800;
                        font-size: 0.95rem;
                        width: 120px;
                        border-right: 1px solid #f1f5f9;
                        position: sticky;
                        left: 0;
                        z-index: 10;
                    }
                    .subject-box {
                        height: 95px;
                        border-radius: 14px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 0.5rem;
                        transition: all 0.2s;
                        background: #fff;
                        min-width: 90px;
                    }
                    .box-regular {
                        color: #4338ca;
                        font-weight: 800;
                        font-size: 1.3rem;
                    }
                    .box-lab {
                        background: #f0fdf4;
                        border: 2px solid #bbf7d0;
                        color: #15803d;
                        font-weight: 800;
                        font-size: 1.3rem;
                    }
                    .box-elective {
                        background: #fffbeb;
                        border: 2px solid #fde68a;
                        color: #b45309;
                        font-weight: 800;
                        font-size: 1.1rem;
                    }
                    /* Strips for Break/Lunch */
                    .strip-cell {
                        width: 40px;
                        background: #f8fafc;
                        font-size: 0.65rem;
                        font-weight: 800;
                        color: #94a3b8;
                        writing-mode: vertical-rl;
                        transform: rotate(180deg);
                        text-align: center;
                        border-left: 1px solid #f1f5f9;
                        border-right: 1px solid #f1f5f9;
                        padding: 0 !important;
                    }
                }
                @media print {
                    .screen-only { display: none !important; }
                    .print-only { display: block !important; padding: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    @page { size: landscape; margin: 5mm; }
                    .official-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; }
                    .official-table th, .official-table td { border: 1px solid black; text-align: center; font-size: 10pt; font-family: "Times New Roman", serif; padding: 4px; }
                    .official-table th { background: #f0f0f0 !important; font-weight: bold; }
                    .break-print {
                        background: #f5f5f5;
                        width: 30px;
                    }
                    .break-text {
                        writing-mode: vertical-rl;
                        transform: rotate(180deg);
                        margin: 0 auto;
                        font-size: 9pt;
                        font-weight: bold;
                        height: 100px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                }
            `}</style>
            <div className="screen-only">
                <header className="dashboard-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#3b82f6', padding: '10px', borderRadius: '12px' }}>
                            <Layers color="white" size={24} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Faculty Dashboard</h1>
                            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>Full Weekly Schedule for {facultyName}</p>
                        </div>
                    </div>
                    <div className="control-group">
                        <button className="btn-premium btn-print" onClick={() => window.print()}>
                            <Printer size={18} /> Print Official
                        </button>
                    </div>
                </header>
                <div className="timetable-glass-card">
                    <table className="main-grid">
                        <thead>
                            <tr>
                                <th style={{ width: '120px' }}>Day</th>
                                {timeSlots && timeSlots.map((slot, index) => {
                                    if (slot.type === 'break') {
                                        return <th key={`head-${index}`} className="strip-cell"></th>;
                                    }
                                    return (
                                        <th key={`head-${index}`}>
                                            {slot.label}<br />
                                            <span style={{ opacity: 0.6, fontSize: '0.6rem' }}>
                                                {formatTime(slot.startTime)}-{formatTime(slot.endTime)}
                                            </span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {DAYS.map((day, dIdx) => {
                                let teachingSlotIndex = 0;
                                return (
                                    <tr key={day}>
                                        <td className="day-column">{day}</td>
                                        {timeSlots && timeSlots.map((slot, sIdx) => {
                                            if (slot.type === 'break') {
                                                return <td key={`brk-${dIdx}-${sIdx}`} className="strip-cell">{slot.label}</td>;
                                            }
                                            const cell = mySchedule[dIdx][teachingSlotIndex];
                                            teachingSlotIndex++;

                                            return (
                                                <td key={`${dIdx}-${sIdx}`}>
                                                    {cell ? (
                                                        <div className={`subject-box ${cell.type === 'LAB' ? 'box-lab' : (cell.type === 'ELECTIVE_GROUP' ? 'box-elective' : 'box-regular')}`}>
                                                            <div style={{ fontSize: '1.1rem' }}>
                                                                {cell.displayCode}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8, color: cell.type === 'LAB' ? '#166534' : (cell.type === 'ELECTIVE_GROUP' ? '#92400e' : '#475569') }}>
                                                                Sem {cell.semester} - {cell.section}
                                                            </div>
                                                            {cell.type === 'LAB' && <div style={{ fontSize: '0.65rem', marginTop: '2px', opacity: 0.7 }}>(LAB)</div>}
                                                        </div>
                                                    ) : (
                                                        <div className="subject-box" style={{ opacity: 0.2 }}>-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* PRINT VIEW (DYNAMIC) */}
            <div className="print-only">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '10px', position: 'relative' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ fontSize: '18pt', margin: 0, fontWeight: 'bold', textTransform: 'uppercase', fontFamily: '"Times New Roman", serif' }}>PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY</h1>
                        <p style={{ fontSize: '10pt', margin: '4px 0', fontStyle: 'italic', fontFamily: '"Times New Roman", serif' }}>(An Autonomous Institution, Affiliated to Anna University, Chennai)</p>
                        <h2 style={{ fontSize: '12pt', margin: '8px 0 0', textDecoration: 'underline', fontWeight: 'bold', fontFamily: '"Times New Roman", serif' }}>INDIVIDUAL FACULTY TIME TABLE</h2>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11pt', marginBottom: '10px', fontFamily: '"Times New Roman", serif' }}>
                    <div>Faculty Name: {facultyName.toUpperCase()}</div>
                    <div>Department: CSE</div>
                </div>
                <table className="official-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>Day</th>
                            {timeSlots && timeSlots.map((slot, index) => {
                                if (slot.type === 'break') {
                                    return (
                                        <th key={index} className="break-print" style={{ width: '30px', padding: 0 }}>
                                            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                                            </div>
                                        </th>
                                    );
                                }
                                return (
                                    <th key={index}>
                                        {slot.label}<br />
                                        <span style={{ fontSize: '8pt', fontWeight: 'normal' }}>
                                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {DAYS.map((day, dIdx) => {
                            let teachingSlotIndex = 0;
                            return (
                                <tr key={day}>
                                    <td style={{ fontWeight: 'bold' }}>{day.substring(0, 3)}</td>
                                    {timeSlots && timeSlots.map((slot, sIdx) => {
                                        if (slot.type === 'break') {
                                            if (dIdx === 0) {
                                                return (
                                                    <td key={`brk-${sIdx}`} rowSpan={6} className="break-print">
                                                        <div className="break-text">{slot.label}</div>
                                                    </td>
                                                );
                                            } else {
                                                return null;
                                            }
                                        }
                                        const cell = mySchedule[dIdx][teachingSlotIndex];
                                        teachingSlotIndex++;
                                        return (
                                            <td key={`${dIdx}-${sIdx}`} style={{ height: '50px' }}>
                                                {cell ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                                        <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{cell.displayCode}</div>
                                                        <div style={{ fontSize: '8pt' }}>SEM {cell.semester} - {cell.section}</div>
                                                    </div>
                                                ) : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default FacultyDashboard;