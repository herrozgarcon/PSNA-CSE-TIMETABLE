import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Check, X, Edit2, Columns, UserPlus, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import DataImporter from '../components/DataImporter';
import Modal from '../components/Modal';

const Allocations = () => {
    const { subjects, teachers, updateTeachers, addTeachers, deleteTeacher, clearTeachers } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);

    // Grid State: Subject ID -> Section ID -> Assignment Object
    const [grid, setGrid] = useState({});
    const [semesterFilter, setSemesterFilter] = useState('');
    const sections = ['A', 'B', 'C', 'D', 'E'];
    const semesters = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

    // Distinct Teachers (Faculty List)
    const distinctTeachers = Array.from(new Map(teachers.map(t => [t.name, t])).values())
        .map(t => ({ id: t.id, name: t.name, department: t.department }));

    // Group assignments by Subject and Section
    useEffect(() => {
        const newGrid = {};
        teachers.forEach(t => {
            if (!t.subject) return;
            const tSub = String(t.subject).trim().toLowerCase();

            // Match subject code/name with robust trimming
            const subjectMatch = subjects.find(s => {
                const sFull = `${s.code} - ${s.name}`.trim().toLowerCase();
                const sCode = String(s.code).trim().toLowerCase();
                return sFull === tSub || sCode === tSub;
            });

            if (!subjectMatch) return;

            if (!newGrid[subjectMatch.id]) newGrid[subjectMatch.id] = {};

            const secMatch = t.assignedClass?.match(/Section ([A-E])/i);
            if (secMatch) {
                const secId = secMatch[1].toUpperCase();
                newGrid[subjectMatch.id][secId] = t;
            }
        });
        setGrid(newGrid);
    }, [teachers, subjects]);

    const handleTeacherChange = (subjectId, sectionId, teacherId) => {
        const subject = subjects.find(s => s.id === subjectId);
        const existingAssignment = grid[subjectId]?.[sectionId];

        if (!teacherId) {
            // Delete assignment
            if (existingAssignment) {
                deleteTeacher(existingAssignment.id);
            }
            return;
        }

        const selectedTeacherTemplate = distinctTeachers.find(t => t.id === teacherId);

        if (existingAssignment) {
            // Update existing
            updateTeachers([{
                ...existingAssignment,
                name: selectedTeacherTemplate.name,
                department: selectedTeacherTemplate.department,
                semester: subject.semester // Sync semester
            }]);
        } else {
            // Add new
            addTeachers([{
                name: selectedTeacherTemplate.name,
                department: selectedTeacherTemplate.department,
                subject: `${subject.code} - ${subject.name}`,
                semester: subject.semester,
                assignedClass: `Section ${sectionId}`
            }]);
        }
    };

    const [typeFilter, setTypeFilter] = useState('All');

    const filteredSubjects = subjects.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSemester = !semesterFilter || s.semester === semesterFilter;
        const matchesType = typeFilter === 'All' || s.type === typeFilter;
        return matchesSearch && matchesSemester && matchesType;
    });

    return (
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
            <div>
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Subject Allocation</h1>
                        <p style={{ color: 'var(--text-light)' }}>Assign faculty members to subject sections ({filteredSubjects.length} subjects shown).</p>
                    </div>
                    <div className="input-group" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>

                        {/* Filter Group */}
                        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                            <select
                                className="input-field"
                                style={{ padding: '4px 8px', height: 'auto', border: 'none', background: semesterFilter === '' ? 'transparent' : '#fff', fontSize: '0.85rem' }}
                                value={semesterFilter}
                                onChange={(e) => setSemesterFilter(e.target.value)}
                            >
                                <option value="">All Sems</option>
                                {semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
                            </select>
                            <select
                                className="input-field"
                                style={{ padding: '4px 8px', height: 'auto', border: 'none', background: typeFilter === 'All' ? 'transparent' : '#fff', fontSize: '0.85rem' }}
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                            >
                                <option value="All">All Types</option>
                                <option value="Lecture">Lecture</option>
                                <option value="Lab">Lab</option>
                            </select>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                className="input-field"
                                style={{ paddingLeft: '36px', minWidth: '200px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '800px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '60px' }}>Sem</th>
                                <th style={{ width: '100px' }}>Code</th>
                                <th style={{ width: '250px' }}>Subject Name</th>
                                {sections.map(s => (
                                    <th key={s} style={{ textAlign: 'center', width: '120px' }}>Section {s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubjects.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                                        No subjects found. Add subjects first.
                                    </td>
                                </tr>
                            ) : (
                                filteredSubjects.map(subject => (
                                    <tr key={subject.id}>
                                        <td>
                                            <span className="badge badge-outline">{subject.semester || '-'}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{subject.code}</span>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{subject.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                                {subject.type} • {subject.credits} Credits
                                            </div>
                                        </td>
                                        {sections.map(section => {
                                            const assignment = grid[subject.id]?.[section];
                                            return (
                                                <td key={section} style={{ padding: '0.5rem' }}>
                                                    <select
                                                        className="form-select"
                                                        style={{
                                                            width: '100%',
                                                            fontSize: '0.8rem',
                                                            borderColor: assignment ? 'var(--primary-light)' : '#e2e8f0',
                                                            padding: '4px 8px',
                                                            background: assignment ? '#eff6ff' : '#fff'
                                                        }}
                                                        value={assignment ? (distinctTeachers.find(t => t.name === assignment.name)?.id || '') : ''}
                                                        onChange={(e) => handleTeacherChange(subject.id, section, e.target.value)}
                                                    >
                                                        <option value="">- Vacant -</option>
                                                        {distinctTeachers.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Workload Summary (Image 1 style) */}
            <div style={{ position: 'sticky', top: '1.5rem', height: 'fit-content' }}>
                <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} className="text-primary" /> Faculty Workload
                    </h3>
                    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                                    <th style={{ textAlign: 'center', padding: '8px' }}>Loads</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distinctTeachers.map((t, idx) => {
                                    const loadCount = teachers.filter(a => a.name === t.name).length;
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '8px' }}>
                                                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{t.name}</div>
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: loadCount > 0 ? 'var(--primary-light)' : '#f1f5f9',
                                                    color: loadCount > 0 ? 'var(--primary)' : 'var(--text-light)',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {loadCount}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <DataImporter />
        </div>
    );
};

export default Allocations;
