const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const app = express();
const PORT = 3000;

app.use(express.static('.'));

const SUBJECTS = ['toan', 'ngu_van', 'ngoai_ngu','vat_li', 'hoa_hoc', 'sinh_hoc','lich_su', 'dia_li', 'gdcd'];

let data = [];

class Student {
  constructor(row) {
    this.sbd = row.sbd;
    this.toan = parseFloat(row.toan) || null;
    this.ngu_van = parseFloat(row.ngu_van) || null;
    this.ngoai_ngu = parseFloat(row.ngoai_ngu) || null;
    this.vat_li = parseFloat(row.vat_li) || null;
    this.hoa_hoc = parseFloat(row.hoa_hoc) || null;
    this.sinh_hoc = parseFloat(row.sinh_hoc) || null;
  }

  getScoreForGroup(group) {
    switch (group) {
      case 'A':   
        return this._valid(this.toan, this.vat_li, this.hoa_hoc) ?
          this.toan + this.vat_li + this.hoa_hoc : null;

      case 'A1':  
        return this._valid(this.toan, this.vat_li, this.ngoai_ngu) ?
          this.toan + this.vat_li + this.ngoai_ngu : null;

      case 'B':   
        return this._valid(this.toan, this.hoa_hoc, this.sinh_hoc) ?
          this.toan + this.hoa_hoc + this.sinh_hoc : null;

      case 'D':   
        return this._valid(this.toan, this.ngu_van, this.ngoai_ngu) ?
          this.toan + this.ngu_van + this.ngoai_ngu : null;

      default:
        return null;
    }
  }

  _valid(...scores) {
    return scores.every(score => typeof score === 'number' && !isNaN(score));
  }

  toGroupResult(group) {
    const total = this.getScoreForGroup(group);
    return {
      sbd: this.sbd,
      total: total?.toFixed(2),
      subjects: {
        toan: this.toan,
        ngu_van: this.ngu_van,
        ngoai_ngu: this.ngoai_ngu,
        vat_li: this.vat_li,
        hoa_hoc: this.hoa_hoc,
        sinh_hoc: this.sinh_hoc
      }
    };
  }
}

class SubjectStats {
  constructor(name) {
    this.name = name;
    this.level1 = 0; // >=8
    this.level2 = 0; // 6–8
    this.level3 = 0; // 4–6
    this.level4 = 0; // <4
  }

  addScore(score) {
    if (score >= 8) this.level1++;
    else if (score >= 6) this.level2++;
    else if (score >= 4) this.level3++;
    else this.level4++;
  }

  toJSON() {
    return {
      level1: this.level1,
      level2: this.level2,
      level3: this.level3,
      level4: this.level4
    };
  }
}

fs.createReadStream('diem_thi_thpt_2024.csv')
  .pipe(csv())
  .on('data', row => data.push(row))
  .on('end', () => console.log('CSV loaded.'));

app.get('/tra-cuu', (req, res) => {
  const sbd = req.query.sbd;
  const student = data.find(d => d.sbd === sbd);
  if (!student) return res.send('❌ Không tìm thấy thí sinh.');

  let output = `🎓 SBD: ${student.sbd}\nToán: ${student.toan}\nNgữ văn: ${student.ngu_van}\nNgoại ngữ: ${student.ngoai_ngu}`;
  const natural = student.vat_li || student.hoa_hoc || student.sinh_hoc;
  const social = student.lich_su || student.dia_li || student.gdcd;

  if (natural) {
    output += `\n📚 Khối: Tự nhiên\nLý: ${student.vat_li}\nHóa: ${student.hoa_hoc}\nSinh: ${student.sinh_hoc}`;
  } else if (social) {
    output += `\n📚 Khối: Xã hội\nSử: ${student.lich_su}\nĐịa: ${student.dia_li}\nGDCD: ${student.gdcd}`;
  }

  res.send(output);
});

app.get('/api/report', (req, res) => {
  const statsMap = {};
  for (const subject of SUBJECTS) {
    statsMap[subject] = new SubjectStats(subject);
  }

  for (const student of data) {
    for (const subject of SUBJECTS) {
      const raw = student[subject];
      const score = parseFloat(raw);
      if (!isNaN(score)) {
        statsMap[subject].addScore(score);
      }
    }
  }

  const report = {};
  for (const subject in statsMap) {
    report[subject] = statsMap[subject].toJSON();
  }

  res.json(report);
});

app.get('/api/top10', (req, res) => {
  const students = data.map(row => new Student(row));
  const groups = ['A', 'A1', 'B', 'D'];
  const result = {};

  for (const group of groups) {
    const validStudents = students
      .map(s => ({ student: s, score: s.getScoreForGroup(group) }))
      .filter(item => item.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.student.toGroupResult(group));

    result[group] = validStudents;
  }

  res.json(result);
});


app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
