/**
 * Timetable Generation Logic
 * Validates constraints and generates a schedule for a single class.
 */

export const generateClassTimetable = (
    classId,       // e.g., "Year 1 - Section A"
    assignments,   // List of { subject, teacher, periodsPerWeek, type }
    masterSchedule // Current global schedule object to check for clashes
) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const times = [
        '08:45 - 09:40', '09:40 - 10:35', '10:55 - 11:45',
        '11:45 - 12:35', '01:35 - 02:25', '02:25 - 03:15', '03:15 - 04:10'
    ];

    const newClassSchedule = {};
    const log = []; // For debug output

    // 1. Expand Requirements into a Pool of Slots
    let slotPool = [];
    assignments.forEach(assign => {
        const isLab = assign.type === 'Lab';
        const rawCredits = String(assign.subject.credits || '0');
        const credits = isNaN(parseInt(rawCredits)) ? 0 : parseInt(rawCredits);

        // RULE: If credit is x, periods = x + 1. If credit is 0, periods = 3.
        const sessionCount = credits > 0 ? (credits + 1) : 3;

        if (isLab) {
            // Labs are usually handled as blocked sessions
            // Labs are handled as a single contiguous block of 'sessionCount'
            slotPool.push({
                ...assign,
                poolId: `${assign.subject.code}-0`,
                isLab: true,
                duration: sessionCount
            });
        } else {
            for (let i = 0; i < sessionCount; i++) {
                slotPool.push({
                    ...assign,
                    poolId: `${assign.subject.code}-${i}`,
                    isLab: false,
                    duration: 1
                });
            }
        }
    });

    // Special Requirement: Mandatory 1 period of an "Editable Subject" on Saturday
    slotPool.push({
        subject: { code: 'EDITABLE', name: 'Editable Subject' },
        teacher: { id: 'special', name: 'Staff' },
        isLab: false,
        duration: 1,
        forceDay: 'Saturday'
    });

    // 2. Sort Pool: Forced Slots First, then Labs (Hardest to fit), then others
    slotPool.sort((a, b) => {
        if (a.forceDay && !b.forceDay) return -1;
        if (!a.forceDay && b.forceDay) return 1;
        return b.duration - a.duration;
    });

    // Helper: Check Teacher Availability
    const isTeacherFree = (teacherId, day, time) => {
        if (!teacherId || teacherId === 'simulate') return true;

        // Exact match for Day and Time suffix to prevent staff clashes
        const targetSuffix = `-${day}-${time}`;

        return !Object.entries(masterSchedule).some(([key, entry]) => {
            return key.endsWith(targetSuffix) && entry.teacherId === teacherId;
        });
    };

    // Helper: Check Class Availability
    const isSlotFree = (day, timeIdx, duration) => {
        for (let k = 0; k < duration; k++) {
            if (timeIdx + k >= times.length) return false; // Out of bounds
            const timeKey = times[timeIdx + k];
            const key = `Y${classId.split(' ')[1]}-S${classId.split(' ').pop()}-${day}-${timeKey}`; // Rough key gen, needs precise match
            // Actually, we are building `newClassSchedule` locally first.
            if (newClassSchedule[`${day}-${timeKey}`]) return false;
        }
        return true;
    };

    // 3. Allocation Loop
    // Tracking usage to spread subjects evenly
    const subjectDayUsage = {}; // subjectCode -> day -> count
    const subjectSessionUsage = {}; // subjectCode -> day -> { FN: bool, AN: bool }

    // Create a matrix of Day x Time
    const matrix = {};
    days.forEach(d => {
        times.forEach(t => { matrix[`${d}-${t}`] = null; });
    });

    // Attempt to place slots
    for (const slot of slotPool) {
        let placed = false;
        const subCode = slot.subject.code;

        if (!subjectDayUsage[subCode]) subjectDayUsage[subCode] = {};
        if (!subjectSessionUsage[subCode]) subjectSessionUsage[subCode] = {};

        // Heuristic: Prefer days with fewer sessions for this subject
        let dayIndices = [0, 1, 2, 3, 4, 5].sort((a, b) => {
            const usageA = subjectDayUsage[subCode][days[a]] || 0;
            const usageB = subjectDayUsage[subCode][days[b]] || 0;
            if (usageA !== usageB) return usageA - usageB;
            return Math.random() - 0.5; // Randomize same-level days
        });

        // If forceDay is specified (e.g., Saturday), only try that day
        if (slot.forceDay) {
            const forcedIdx = days.indexOf(slot.forceDay);
            if (forcedIdx !== -1) dayIndices = [forcedIdx];
        }

        for (const dIdx of dayIndices) {
            if (placed) break;
            const day = days[dIdx];
            if (!subjectSessionUsage[subCode][day]) subjectSessionUsage[subCode][day] = { FN: false, AN: false };

            // Determine preference: If we already have FN, try AN first, and vice-versa
            let timeIndices = [0, 1, 2, 3, 4, 5, 6];
            const hasFN = subjectSessionUsage[subCode][day].FN;
            const hasAN = subjectSessionUsage[subCode][day].AN;

            if (hasFN && !hasAN) {
                // Prefer AN (4,5,6) then FN (0,1,2,3)
                timeIndices = [4, 5, 6, 0, 1, 2, 3];
            } else if (!hasFN && hasAN) {
                // Prefer FN (0,1,2,3) then AN (4,5,6)
                timeIndices = [0, 1, 2, 3, 4, 5, 6];
            } else {
                // Standard order or randomized
                timeIndices = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
            }

            for (const tIdx of timeIndices) {
                if (tIdx > times.length - slot.duration) continue;
                const time = times[tIdx];

                // 1. Valid Slot?
                let collides = false;
                for (let k = 0; k < slot.duration; k++) {
                    if (matrix[`${day}-${times[tIdx + k]}`]) collides = true;
                    // LUNCH BREAK CONSTRAINT: Session cannot cross from period 4 (idx 3) to period 5 (idx 4)
                    if (tIdx < 4 && (tIdx + k) >= 4) collides = true;
                }
                if (collides) continue;

                // 2. Teacher Available?
                let teacherClash = false;
                if (slot.teacher?.id !== 'special') {
                    for (let k = 0; k < slot.duration; k++) {
                        if (!isTeacherFree(slot.teacher?.id, day, times[tIdx + k])) teacherClash = true;
                    }
                }
                if (teacherClash) continue;

                // 3. Place it
                for (let k = 0; k < slot.duration; k++) {
                    const exactTime = times[tIdx + k];
                    matrix[`${day}-${exactTime}`] = slot;

                    // Update tracking
                    subjectDayUsage[subCode][day] = (subjectDayUsage[subCode][day] || 0) + 1;
                    if (tIdx + k < 4) subjectSessionUsage[subCode][day].FN = true;
                    else subjectSessionUsage[subCode][day].AN = true;
                }
                placed = true;
                break;
            }
        }

        if (!placed) {
            log.push(`Could not place ${slot.subject.code} (${slot.type}). Constraints too tight.`);
        }
    }

    // Convert local matrix to Global Schedule Key format
    // Expected Key: Sem<Semester>-S<Sec>-<Day>-<Time>
    // classId format: "Sem II - Section A"
    const [semPart, sPart] = classId.split(' - ');
    const sem = semPart.replace('Sem ', '');
    const section = sPart.replace('Section ', '');

    const finalSchedule = {};
    Object.keys(matrix).forEach(k => {
        const [day, time] = k.split(/-(.+)/); // Split only on first hyphen
        const val = matrix[k];
        if (val) {
            const key = `Sem${sem}-S${section}-${day}-${time}`;
            finalSchedule[key] = {
                subject: `${val.subject.code} - ${val.subject.name}`,
                code: val.subject.code,
                name: val.subject.name,
                type: val.type,
                teacherName: val.teacher.name,
                teacherId: val.teacher.id,
                room: (val.teacher.room || val.subject.room || "")
            };
        }
    });

    return { schedule: finalSchedule, errors: log };
};

export const findSubstitute = (
    absentTeacherId,
    date,
    period,
    dayName, // "Monday"
    masterSchedule,
    teachers,
    subjects
) => {
    // 1. Identify Subject of the absent class
    // We need the class context. But usually substitutes are found BY slot.
    // ...
    // Simplified: Return list of available teachers who match the department or subject

    // Filter teachers who are FREE at this time
    const time = period; // "08:45 - 09:40"

    const available = teachers.filter(t => {
        if (t.id === absentTeacherId) return false;

        // Check availability
        for (const key in masterSchedule) {
            if (key.includes(`${dayName}-${time}`) && masterSchedule[key].teacherId === t.id) {
                return false; // Busy
            }
        }
        return true;
    });

    // Score them:
    // 1. Same Department (High Priority)
    // 2. Same Subject Skill (Best)
    // 3. Workload (Less is better)

    // (Mock ranking for now)
    return available.map(t => ({
        ...t,
        matchScore: 10 // Placeholder
    }));
};
