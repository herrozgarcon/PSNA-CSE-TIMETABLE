import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx';
import { Upload, Save, FileSpreadsheet, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ExcelPreview.css';
import { v4 as uuidv4 } from 'uuid';
const ExcelPreview = () => {
    const { setSubjects, setTeachers, updateSchedule, facultyAccounts, addFacultyAccounts, addSubjects, addTeachers, subjects, teachers } = useData();
    const navigate = useNavigate();
    const [grid, setGrid] = useState(() => {
        const saved = sessionStorage.getItem('excel_preview_grid');
        return saved ? JSON.parse(saved) : [];
    });
    const [fileName, setFileName] = useState(() => {
        return sessionStorage.getItem('excel_preview_filename') || '';
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            const rows = [];
            for (let R = 0; R <= range.e.r; ++R) {
                const row = [];
                for (let C = 0; C <= range.e.c; ++C) {
                    const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
                    row.push(cell ? cell.v : '');
                }
                rows.push(row);
            }
            setGrid(rows);
            sessionStorage.setItem('excel_preview_grid', JSON.stringify(rows));
            sessionStorage.setItem('excel_preview_filename', file.name);
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };
    const processAndSave = async () => {
        if (grid.length === 0) return;
        try {
            // We use add* functions to append/update instead of replacing everything (set*).
            // This prevents wiping data when uploading semester by semester.

            const rows = grid;
            let currentSem = 'General';
            let currentType = 'Lecture';
            let currentIndices = null;

            const newSubjects = [];
            const newTeachers = [];
            const allAffectedSemesters = new Set();

            const safeInt = (val) => {
                if (val === undefined || val === null || val === '') return 0;
                let s = String(val).trim();
                const match = s.match(/(\d+)/);
                return match ? parseInt(match[0]) : 0;
            };

            // Improved header parsing based on the screenshot structure
            const detectHeaders = (row) => {
                const h = row.map(cell => String(cell || '').trim().toUpperCase());
                // Look for anchor columns
                const codeIdx = h.findIndex(x => x === 'SUB.CODE' || x === 'SUB.COD');
                const nameIdx = h.findIndex(x => x === 'SUBJECT NAME');

                if (codeIdx === -1 || nameIdx === -1) return null;

                // Detect sections (A, B, C, D...) which appear after Subject Name
                const sections = [];
                for (let i = nameIdx + 1; i < h.length; i++) {
                    const val = h[i];
                    if (['A', 'B', 'C', 'D', 'E'].includes(val)) {
                        sections.push({ idx: i, name: val });
                    }
                    // Stop if we hit other meta columns to avoid false positives
                    if (val.includes('NO OF SECTION') || val.includes('SUB HAND DEPT')) break;
                }

                // If no sections found in this row, maybe they are in the row above? (merged headers)
                // For now, let's assume standard format or previous valid sections.

                return {
                    codeIdx,
                    nameIdx,
                    semIdx: h.findIndex(x => x === 'SEMESTER') || 0, // Should be 0 based on screenshot
                    sections
                };
            };

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 3) continue;

                const rowUpper = row.map(c => String(c || '').trim().toUpperCase());
                const rowStr = rowUpper.join(' ');

                // 1. Semantic Block Detection
                if (rowStr.includes('PRACTICAL')) currentType = 'Lab';
                else if (rowStr.includes('THEORY')) currentType = 'Lecture';

                // 2. Header Detection
                // Check if this row is a header row
                if (rowUpper.some(c => c === 'SUB.CODE')) {
                    const detected = detectHeaders(row);
                    if (detected && detected.sections.length > 0) {
                        currentIndices = detected;
                    }
                    continue; // Skip the header row itself
                }

                // 3. Data Row Processing
                if (!currentIndices) continue; // Need headers first

                const code = String(row[currentIndices.codeIdx] || '').trim();
                const name = String(row[currentIndices.nameIdx] || '').trim();
                const semRaw = String(row[currentIndices.semIdx] || '').trim(); // e.g., "IV CSE"

                // Valid row check: must have a code like "CS2411" or "IT2101" etc.
                if (!code || code.length < 3 || !name || name.toUpperCase().includes('TOTAL')) continue;

                // Helper to extract clean semester from "IV CSE", "VI CSE"
                // Regex looks for Roman numerals at start
                let rowSem = currentSem;
                const semMatch = semRaw.match(/^([IXV]+)\s/);
                if (semMatch) {
                    rowSem = `SEM ${semMatch[1]}`;
                    currentSem = rowSem; // update global context just in case
                } else if (semRaw.toUpperCase().includes('SEM')) {
                    // Fallback
                    currentSem = semRaw;
                }
                allAffectedSemesters.add(rowSem);

                // Determine Credits/Hours
                // Based on screenshot, "No.of Hours allotted" is usually after sections
                // Let's try to find it dynamically or assume position
                let credit = 0;
                // Try finding a number at the end of the row (last non-empty cell?)
                // Or looking for specific column index if we knew it.
                // Screenshot shows it's around column M/N (index 12/13).
                // Let's stick to the previous heuristic but safer
                // "No.of Hours allotted" is typically col index 12 or 13 in standard templates
                // We'll search for a number > 0 in columns after the sections
                const lastSectionIdx = currentIndices.sections[currentIndices.sections.length - 1].idx;
                for (let k = lastSectionIdx + 1; k < row.length; k++) {
                    const val = safeInt(row[k]);
                    if (val > 0 && val < 10) { // Reasonable credit range
                        credit = val;
                        break;
                    }
                }
                if (credit === 0) credit = 3; // Default

                let finalType = (name.toUpperCase().includes('LAB') || name.toUpperCase().includes('PRACTICAL') || currentType === 'Lab') ? 'Lab' : 'Lecture';

                newSubjects.push({
                    id: uuidv4(),
                    code, name,
                    semester: rowSem,
                    credit,
                    satCount: 0,
                    type: finalType
                });

                // Teachers
                currentIndices.sections.forEach(secObj => {
                    const teacherRaw = String(row[secObj.idx] || '').trim();
                    if (teacherRaw && teacherRaw.length > 1 && !['YES', 'NO', 'NIL', '-'].includes(teacherRaw.toUpperCase())) {
                        // Split by '/' if multiple teachers
                        const teachersInCell = teacherRaw.split('/').map(t => t.trim()).filter(t => t.length > 1);

                        teachersInCell.forEach(tName => {
                            newTeachers.push({
                                id: uuidv4(),
                                name: tName,
                                subjectCode: code,
                                section: secObj.name,
                                semester: rowSem
                            });
                        });
                    }
                });
            }

            // Using addSubjects/addTeachers keeps existing data
            if (newSubjects.length > 0) {
                // Filter out incoming subjects that might already exist (same code & semester)
                const existingKeys = new Set(subjects.map(s => `${s.code}-${s.semester}`));
                const uniqueNewSubjects = newSubjects.filter(s => !existingKeys.has(`${s.code}-${s.semester}`));
                if (uniqueNewSubjects.length < newSubjects.length) {
                    console.warn(`Skipped ${newSubjects.length - uniqueNewSubjects.length} duplicate subjects.`);
                }
                if (uniqueNewSubjects.length > 0) {
                    await addSubjects(uniqueNewSubjects);
                }
            }

            if (newTeachers.length > 0) {
                const existingTeacherKeys = new Set(teachers.map(t => `${t.subjectCode}-${t.section}-${t.semester}`));
                const uniqueNewTeachers = newTeachers.filter(t => !existingTeacherKeys.has(`${t.subjectCode}-${t.section}-${t.semester}`));
                if (uniqueNewTeachers.length < newTeachers.length) {
                    console.warn(`Skipped ${newTeachers.length - uniqueNewTeachers.length} duplicate allocations.`);
                }
                if (uniqueNewTeachers.length > 0) {
                    await addTeachers(uniqueNewTeachers);
                }
            }

            allAffectedSemesters.forEach(async (sem) => await updateSchedule(sem, {}));

            // --- Auto-Create Faculty Accounts ENABLED ---
            // If teachers are missing, we create them automatically to allow allocation.

            const uniqueTeacherNames = [...new Set(newTeachers.map(t => t.name))];
            const missingAccounts = uniqueTeacherNames.filter(name => {
                const normName = name.toLowerCase().trim();
                // Check if this teacher exists in the registered faculty accounts
                return !facultyAccounts.some(acc => acc.name.toLowerCase().trim() === normName);
            });

            if (missingAccounts.length > 0) {
                const newAccounts = missingAccounts.map(name => {
                    const nameParts = name.split(/\s+/);
                    const lastNameRaw = nameParts[nameParts.length - 1];
                    let handle = lastNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (handle.length < 3) handle = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);

                    // Ensure uniqueness of handle if possible (simple random suffix if needed, but for now stick to logic)
                    // Better: check against existing emails?
                    // For now, let's keep it simple as per Teachers.jsx

                    return {
                        id: uuidv4() + '_acc',
                        name: name,
                        email: `${handle}@psnacet.edu.in`,
                        password: handle, // Default password is same as handle
                        dept: 'General', // Default department
                        can_generate: false // Default permission
                    };
                });

                await addFacultyAccounts(newAccounts);
                console.log(`Auto-created ${newAccounts.length} missing faculty accounts.`);

                // Update local list of accounts to ensure subsequent checks pass (though we are done with checks)
            }

            // If we reach here, all teachers exist. Proceed to save.

            if (newSubjects.length > 0) {
                // ... existing logic to add subjects ...
                // Filter out incoming subjects that might already exist (same code & semester)
                const existingKeys = new Set(subjects.map(s => `${s.code}-${s.semester}`));
                const uniqueNewSubjects = newSubjects.filter(s => !existingKeys.has(`${s.code}-${s.semester}`));
                if (uniqueNewSubjects.length < newSubjects.length) {
                    console.warn(`Skipped ${newSubjects.length - uniqueNewSubjects.length} duplicate subjects.`);
                }
                if (uniqueNewSubjects.length > 0) {
                    await addSubjects(uniqueNewSubjects);
                }
            }

            if (newTeachers.length > 0) {
                const existingTeacherKeys = new Set(teachers.map(t => `${t.subjectCode}-${t.section}-${t.semester}`));
                const uniqueNewTeachers = newTeachers.filter(t => !existingTeacherKeys.has(`${t.subjectCode}-${t.section}-${t.semester}`));
                if (uniqueNewTeachers.length < newTeachers.length) {
                    console.warn(`Skipped ${newTeachers.length - uniqueNewTeachers.length} duplicate allocations.`);
                }
                if (uniqueNewTeachers.length > 0) {
                    await addTeachers(uniqueNewTeachers);
                }
            }

            allAffectedSemesters.forEach(async (sem) => await updateSchedule(sem, {}));

            setMessage({
                type: 'success',
                text: `Sync Complete: ${newSubjects.length} subjects found. Allocations updated for verified faculty.`
            });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Import failed. Check Excel format.' });
        }
    };
    const getColumnLetter = (index) => {
        let letter = '';
        while (index >= 0) {
            letter = String.fromCharCode((index % 26) + 65) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    };
    return (
        <div className="excel-preview-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Excel Data Preview</h1>
                    <p>M=Weekday, N=Sat | Sections A-E Only</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline btn-rotate-icon" onClick={() => { setGrid([]); setFileName(''); sessionStorage.removeItem('excel_preview_grid'); }}>
                        <RefreshCw size={18} /> Reset
                    </button>
                    <button className="btn btn-primary" onClick={processAndSave}>
                        <Save size={18} /> Import Excel Data
                    </button>
                </div>
            </div>
            {message && (
                <div className={`alert-banner ${message.type}`} style={{
                    padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem',
                    backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    border: `2px solid ${message.type === 'success' ? '#16a34a' : '#ef4444'}`,
                    fontWeight: 800
                }}>{message.text}</div>
            )}
            <div className="card excel-card">
                {!grid.length ? (
                    <div className="empty-state">
                        <FileSpreadsheet size={64} />
                        <label className="btn btn-primary mt-2" style={{ cursor: 'pointer' }}>
                            <Upload size={18} /> Select Excel File
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                    </div>
                ) : (
                    <div className="excel-table-container">
                        <table className="excel-table">
                            <thead>
                                <tr>
                                    <th className="excel-row-header"></th>
                                    {grid[0]?.map((_, i) => <th key={i}>{getColumnLetter(i)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {grid.slice(0, 300).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <td className="excel-row-header">{rIdx + 1}</td>
                                        {row.map((cell, cIdx) => <td key={cIdx}>{cell}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ExcelPreview;