import React, { createContext, useContext, useState, useEffect } from 'react';
const DataContext = createContext();
export const useData = () => useContext(DataContext);
export const DataProvider = ({ children }) => {
    const safeParse = (key, fallback) => {
        try {
            const item = localStorage.getItem(key);
            if (!item) return fallback;
            const parsed = JSON.parse(item);
            return parsed === null ? fallback : parsed;
        } catch (e) {
            console.error(`Error parsing ${key}`, e);
            return fallback;
        }
    };
    const [teachers, setTeachers] = useState(() => {
        const val = safeParse('timetable_teachers', []);
        return Array.isArray(val) ? val : [];
    });
    const [subjects, setSubjects] = useState(() => {
        const val = safeParse('timetable_subjects', []);
        return Array.isArray(val) ? val : [];
    });
    const [schedule, setSchedule] = useState(() => {
        const val = safeParse('timetable_schedule', {});
        return (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
    });
    const [facultyAccounts, setFacultyAccounts] = useState(() => {
        const val = safeParse('timetable_faculty_accounts', []);
        return Array.isArray(val) ? val : [];
    });
    const [rooms, setRooms] = useState(() => {
        const val = safeParse('timetable_rooms', []);
        return Array.isArray(val) ? val : [];
    });
    const [timeSlots, setTimeSlots] = useState(() => {
        const val = safeParse('timetable_slots', []);
        // Default structure if empty
        if (!val || val.length === 0) {
            return [
                { id: 'p1', startTime: '08:45', endTime: '09:40', label: 'P1', type: 'teaching' },
                { id: 'p2', startTime: '09:40', endTime: '10:35', label: 'P2', type: 'teaching' },
                { id: 'b1', startTime: '10:35', endTime: '10:55', label: 'BREAK', type: 'break' },
                { id: 'p3', startTime: '10:55', endTime: '11:45', label: 'P3', type: 'teaching' },
                { id: 'p4', startTime: '11:45', endTime: '12:35', label: 'P4', type: 'teaching' },
                { id: 'l1', startTime: '12:35', endTime: '01:45', label: 'LUNCH', type: 'break' },
                { id: 'p5', startTime: '01:45', endTime: '02:35', label: 'P5', type: 'teaching' },
                { id: 'p6', startTime: '02:35', endTime: '03:25', label: 'P6', type: 'teaching' },
                { id: 'p7', startTime: '03:25', endTime: '04:15', label: 'P7', type: 'teaching' }
            ];
        }
        return val;
    });
    const [preemptiveConstraints, setPreemptiveConstraints] = useState(() => {
        const val = safeParse('timetable_preemptive_constraints', {});
        return (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
    });
    const [department, setDepartment] = useState(localStorage.getItem('timetable_department') || 'General');
    useEffect(() => {
        localStorage.setItem('timetable_department', department);
    }, [department]);
    useEffect(() => {
        localStorage.setItem('timetable_teachers', JSON.stringify(teachers));
    }, [teachers]);
    useEffect(() => {
        localStorage.setItem('timetable_subjects', JSON.stringify(subjects));
    }, [subjects]);
    useEffect(() => {
        localStorage.setItem('timetable_schedule', JSON.stringify(schedule));
    }, [schedule]);
    useEffect(() => {
        localStorage.setItem('timetable_faculty_accounts', JSON.stringify(facultyAccounts));
    }, [facultyAccounts]);
    useEffect(() => {
        localStorage.setItem('timetable_preemptive_constraints', JSON.stringify(preemptiveConstraints));
    }, [preemptiveConstraints]);
    useEffect(() => {
        localStorage.setItem('timetable_rooms', JSON.stringify(rooms));
    }, [rooms]);
    useEffect(() => {
        localStorage.setItem('timetable_slots', JSON.stringify(timeSlots));
    }, [timeSlots]);
    const addTeachers = (newTeachers) => {
        setTeachers(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = newTeachers.filter(t => !existingIds.has(t.id));
            return [...prev, ...uniqueNew];
        });
    };
    const deleteTeachers = (id) => setTeachers(prev => prev.filter(t => t.id !== id));
    const clearTeachers = () => setTeachers([]);
    const addSubjects = (newSubjects) => {
        setSubjects(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = newSubjects.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNew];
        });
    };
    const deleteSubjects = (id) => setSubjects(prev => prev.filter(s => s.id !== id));
    const clearSubjects = () => setSubjects([]);
    const addFacultyAccounts = (newAccounts) => {
        setFacultyAccounts(prev => {
            const accountMap = new Map(prev.map(a => [a.email, a]));
            newAccounts.forEach(acc => accountMap.set(acc.email, acc));
            return Array.from(accountMap.values());
        });
    };
    const clearFacultyAccounts = () => setFacultyAccounts([]);
    const clearPreemptiveConstraints = () => setPreemptiveConstraints({});

    const addRooms = (newRooms) => {
        setRooms(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const uniqueNew = newRooms.filter(r => !existingIds.has(r.id));
            return [...prev, ...uniqueNew];
        });
    };
    const deleteRoom = (id) => setRooms(prev => prev.filter(r => r.id !== id));
    const updateRoom = (updated) => setRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
    const updateSchedule = (semester, newSchedule) => {
        setSchedule(prev => ({
            ...prev,
            [semester]: newSchedule
        }));
    };
    const updateSubjects = (newSubjects) => setSubjects(newSubjects);
    return (
        <DataContext.Provider value={{
            teachers,
            subjects,
            schedule,
            facultyAccounts,
            timeSlots,
            setTimeSlots,
            preemptiveConstraints,
            addTeachers,
            deleteTeachers,
            clearTeachers,
            addSubjects,
            updateSubjects,
            deleteSubjects,
            clearSubjects,
            updateSchedule,
            addFacultyAccounts,
            clearFacultyAccounts,
            setPreemptiveConstraints,
            clearPreemptiveConstraints,
            rooms,
            setRooms,
            addRooms,
            deleteRoom,
            updateRoom,
            setTeachers,
            setSubjects,
            setFacultyAccounts,
            department,
            setDepartment
        }}>
            {children}
        </DataContext.Provider>
    );
};