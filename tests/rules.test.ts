import {describe,it,expect} from 'vitest';
import {DEFAULT_CALENDAR,HOLIDAYS_2027,isWorking,addMonths,blockedDays,calculateMaxEndDate,getValidEndDates,evaluate,quotaFor,reminderAt,limitFor,type Employee,type Leave,type LeaveInput} from '../shared/domain';
const employee:Employee={id:'a',name:'A',email:'a@example.test',phone:'08123456789',unit:'KC01',position:'CS_BINA',roles:['EMPLOYEE'],active:true};
const input:LeaveInput={category:'REGULAR',subtype:'Keluarga',reason:'Keperluan keluarga.',start:'2026-10-05',end:'2026-10-09',email:employee.email,phone:employee.phone};
const calculate=(override:Partial<LeaveInput>={},all:Leave[]=[],limit=2,today='2026-09-01',calendar=DEFAULT_CALENDAR)=>evaluate({...input,...override},employee,all,calendar,limit,today);
function request(id:string,days:string[],extra:Partial<Leave>={}):Leave{return {...input,id,number:id,employeeId:id,employeeName:id,position:employee.position,unit:employee.unit,status:'PENDING_SDM',days,effectiveStart:days[0],effectiveEnd:days.at(-1)!,duration:days.length,submittedAt:'2026-09-01T00:00:00Z',createdAt:'2026-09-01T00:00:00Z',confirmation:'NOT_CONFIRMED',version:1,calendarVersion:1,limit:2,events:[],...extra};}
describe('Tanggal dan cutoff hari kerja',()=>{
  it('menghitung H-3 Oktober 28–30 dan September 28–30',()=>{expect(blockedDays('2026-10',DEFAULT_CALENDAR)).toEqual(['2026-10-28','2026-10-29','2026-10-30']);expect(blockedDays('2026-09',DEFAULT_CALENDAR)).toEqual(['2026-09-28','2026-09-29','2026-09-30']);});
  it('memotong 26–30 Oktober menjadi 2 hari',()=>{const p=calculate({start:'2026-10-26',end:'2026-10-30'});expect(p.days).toEqual(['2026-10-26','2026-10-27']);expect(p.adjusted).toBe(true);expect(p.errors).toEqual([]);});
  it('libur 30 Oktober menggeser H-3 ke 27–29',()=>{const c={...DEFAULT_CALENDAR,exceptions:{'2026-10-30':{working:false,label:'Fixture'}}};expect(blockedDays('2026-10',c)).toEqual(['2026-10-27','2026-10-28','2026-10-29']);expect(calculate({start:'2026-10-26',end:'2026-10-30'},[],2,'2026-09-01',c).duration).toBe(1);});
  it('menolak mulai H-3',()=>expect(calculate({start:'2026-10-28',end:'2026-10-30'}).errors.map(e=>e.code)).toContain('MONTH_END_BLOCKED'));
  it('menerapkan clamp satu bulan termasuk kabisat',()=>{expect(addMonths('2027-01-31',1)).toBe('2027-02-28');expect(addMonths('2028-01-31',1)).toBe('2028-02-29');});
  it('masa tunggu berlaku saat submit sebenarnya',()=>expect(calculate({start:'2026-10-27',end:'2026-10-27'},[],2,'2026-09-29').errors.map(e=>e.code)).toContain('NOTICE_PERIOD'));
  it('akhir pekan tidak termasuk durasi',()=>expect(calculate({start:'2026-10-06',end:'2026-10-10'}).duration).toBe(4));
  it('lebih dari lima hari ditolak',()=>expect(calculate({end:'2026-10-12'}).errors.map(e=>e.code)).toContain('DURATION_LIMIT'));
  it('tidak melanjutkan lintas bulan',()=>expect(calculate({start:'2026-10-27',end:'2026-11-03'}).days).toEqual(['2026-10-27']));
  it('darurat bebas masa tunggu saja',()=>{expect(calculate({category:'EMERGENCY',start:'2026-09-01',end:'2026-09-01'}).errors).toEqual([]);expect(calculate({category:'EMERGENCY',start:'2026-09-29',end:'2026-09-29'}).errors.map(e=>e.code)).toContain('MONTH_END_BLOCKED');});
  it('menolak tanggal palsu dan rentang terbalik',()=>{expect(calculate({start:'2026-02-30'}).errors[0].code).toBe('INVALID_RANGE');expect(calculate({end:'2026-10-01'}).errors[0].code).toBe('INVALID_RANGE');});
  it('bulan dengan kurang dari tiga hari kerja seluruhnya diblokir',()=>{const c={...DEFAULT_CALENDAR,weekdays:[],exceptions:{'2026-10-01':{working:true,label:'Kerja'}}};expect(calculate({start:'2026-10-01',end:'2026-10-01'},[],2,'2026-09-01',c).errors.map(e=>e.code)).toContain('MONTH_END_BLOCKED');});
  it('menyesuaikan tanggal akhir maksimal 5 hari kerja dengan libur dan cutoff',()=>{
    expect(calculateMaxEndDate('2026-10-05',DEFAULT_CALENDAR)).toBe('2026-10-09');
    expect(calculateMaxEndDate('2026-12-08',DEFAULT_CALENDAR)).toBe('2026-12-14');
    expect(calculateMaxEndDate('2026-10-26',DEFAULT_CALENDAR)).toBe('2026-10-27');
    const c={...DEFAULT_CALENDAR,exceptions:{'2026-12-09':{working:false,label:'Libur'}}};
    expect(calculateMaxEndDate('2026-12-08',c)).toBe('2026-12-15');
  });
  it('menghasilkan tanggal akhir valid hanya pada hari kerja dan mengabaikan akhir pekan / libur',()=>{
    const valid=getValidEndDates('2026-12-03',DEFAULT_CALENDAR);
    expect(valid).toEqual(['2026-12-03','2026-12-04','2026-12-07','2026-12-08','2026-12-09']);
    expect(valid).not.toContain('2026-12-05'); // Sabtu tidak boleh dipilih
    expect(valid).not.toContain('2026-12-06'); // Minggu tidak boleh dipilih
  });
});
describe('Kuota orang, bukan hari',()=>{
  it('lima hari kerja tetap bisa pada kuota dua orang',()=>{expect(calculate().duration).toBe(5);expect(calculate().errors).toEqual([]);});
  it('orang A tanggal 1 dan B tanggal 20 menghabiskan kuota',()=>{const all=[request('b',['2026-10-01']),request('c',['2026-10-20'])];expect(calculate({},all).errors.map(e=>e.code)).toContain('QUOTA_EXCEEDED');});
  it('approved dan pending orang yang sama hanya dihitung satu',()=>{const all=[request('a',['2026-10-01']),request('a',['2026-10-20'],{status:'APPROVED'})];const q=quotaFor('CS_BINA','2026-10',all,2);expect([q.used,q.approved,q.pending,q.available]).toEqual([1,1,0,1]);});
  it('penolakan sebagian tidak melepaskan slot approved',()=>{const all=[request('b',['2026-10-01'],{status:'APPROVED'}),request('b',['2026-10-20'],{status:'REJECTED'})];expect(quotaFor('CS_BINA','2026-10',all,2).used).toBe(1);});
  it('slot aktif tetap bisa pengajuan kedua meski kuota penuh',()=>{const all=[request('a',['2026-10-01']),request('b',['2026-10-20'])];expect(calculate({},all).errors).toEqual([]);});
  it('bulan baru tidak memakai slot bulan sebelumnya',()=>expect(quotaFor('CS_BINA','2026-11',[request('a',['2026-10-01'])],2).used).toBe(0));
  it('limit bucket lama tetap saat kebijakan masa depan berubah',()=>expect(limitFor('CS_BINA','2026-10',{calendar:DEFAULT_CALENDAR,quotas:{'2026-10':{CS_BINA:8}}},[request('a',['2026-10-01'])])).toBe(2));
});
describe('Benturan jadwal',()=>{
  it('irisan dua hari diizinkan',()=>expect(calculate({start:'2026-10-08',end:'2026-10-12'},[request('b',['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'])]).errors).toEqual([]));
  it('irisan tiga hari ditolak',()=>expect(calculate({start:'2026-10-07',end:'2026-10-09'},[request('b',['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'])]).errors.map(e=>e.code)).toContain('OVERLAP_LIMIT'));
  it('rentang identik dua hari tetap ditolak',()=>expect(calculate({start:'2026-10-08',end:'2026-10-09'},[request('b',['2026-10-08','2026-10-09'])]).errors.map(e=>e.code)).toContain('IDENTICAL_RANGE'));
  it('irisan milik sendiri satu hari ditolak',()=>expect(calculate({},[request('a',['2026-10-05'])]).errors.map(e=>e.code)).toContain('OWN_CONFLICT'));
  it('posisi berbeda tidak konflik',()=>expect(calculate({},[request('b',['2026-10-05','2026-10-06','2026-10-07'],{position:'TELLER'})]).errors).toEqual([]));
  it('batas orang bersamaan mengikuti kuota',()=>expect(calculate({start:'2026-10-05',end:'2026-10-06'},[request('b',['2026-10-05']),request('c',['2026-10-06'])],1).errors.map(e=>e.code)).toContain('CONCURRENT_PEOPLE_LIMIT'));
});
describe('Jadwal email',()=>{
  it('reguler mulai 2 November dikirim 2 Oktober jam 08 WIB',()=>expect(reminderAt('2026-11-02','REGULAR',new Date('2026-09-29T00:00:00Z'))).toBe('2026-10-02T01:00:00.000Z'));
  it('due yang terlewati dan darurat dijadwalkan segera',()=>{const now=new Date('2026-09-29T10:00:00Z');expect(reminderAt('2026-10-29','REGULAR',now)).toBe(now.toISOString());expect(reminderAt('2026-09-29','EMERGENCY',now)).toBe(now.toISOString());});
});
describe('Hari libur nasional dan cuti bersama 2027',()=>{
  it('memuat 26 hari libur dan cuti bersama 2027 pada DEFAULT_CALENDAR',()=>{
    const dates=Object.keys(HOLIDAYS_2027);
    expect(dates).toHaveLength(26);
    expect(Object.keys(DEFAULT_CALENDAR.exceptions)).toHaveLength(26);
  });
  it('semua hari libur 2027 bukan merupakan hari kerja',()=>{
    for(const [date,config] of Object.entries(HOLIDAYS_2027)){
      expect(config.working).toBe(false);
      expect(isWorking(date,DEFAULT_CALENDAR)).toBe(false);
    }
  });
  it('mencakup 18 tanggal libur nasional sesuai daftar gambar',()=>{
    expect(HOLIDAYS_2027['2027-01-01'].label).toBe('Tahun Baru 2027 Masehi');
    expect(HOLIDAYS_2027['2027-01-05'].label).toBe('Isra Miraj Nabi Muhammad SAW');
    expect(HOLIDAYS_2027['2027-02-06'].label).toBe('Tahun Baru Imlek 2578 Kongzili');
    expect(HOLIDAYS_2027['2027-03-08'].label).toBe('Hari Suci Nyepi (Tahun Baru Saka 1949)');
    expect(HOLIDAYS_2027['2027-03-10'].label).toBe('Idul Fitri 1448 Hijriah');
    expect(HOLIDAYS_2027['2027-03-11'].label).toBe('Idul Fitri 1448 Hijriah');
    expect(HOLIDAYS_2027['2027-03-26'].label).toBe('Wafat Yesus Kristus');
    expect(HOLIDAYS_2027['2027-03-28'].label).toBe('Hari Kebangkitan Yesus Kristus (Paskah)');
    expect(HOLIDAYS_2027['2027-05-01'].label).toBe('Hari Buruh Internasional');
    expect(HOLIDAYS_2027['2027-05-06'].label).toBe('Kenaikan Yesus Kristus');
    expect(HOLIDAYS_2027['2027-05-17'].label).toBe('Idul Adha 1448 Hijriah');
    expect(HOLIDAYS_2027['2027-05-20'].label).toBe('Hari Raya Waisak 2571 BE');
    expect(HOLIDAYS_2027['2027-06-01'].label).toBe('Hari Lahir Pancasila');
    expect(HOLIDAYS_2027['2027-06-06'].label).toBe('1 Muharam Tahun Baru Islam 1449 Hijriah');
    expect(HOLIDAYS_2027['2027-08-15'].label).toBe('Maulid Nabi Muhammad SAW');
    expect(HOLIDAYS_2027['2027-08-17'].label).toBe('Proklamasi Kemerdekaan');
    expect(HOLIDAYS_2027['2027-12-25'].label).toBe('Kelahiran Yesus Kristus (Natal)');
    expect(HOLIDAYS_2027['2027-12-26'].label).toBe('Isra Miraj Nabi Muhammad SAW');
  });
  it('mencakup 8 tanggal cuti bersama sesuai daftar gambar',()=>{
    expect(HOLIDAYS_2027['2027-02-05'].label).toBe('Cuti Bersama Tahun Baru Imlek 2578 Kongzili');
    expect(HOLIDAYS_2027['2027-03-09'].label).toBe('Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah');
    expect(HOLIDAYS_2027['2027-03-12'].label).toBe('Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah');
    expect(HOLIDAYS_2027['2027-03-15'].label).toBe('Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah');
    expect(HOLIDAYS_2027['2027-03-25'].label).toBe('Cuti Bersama Wafat Yesus Kristus');
    expect(HOLIDAYS_2027['2027-05-18'].label).toBe('Cuti Bersama Idul Adha 1448 H');
    expect(HOLIDAYS_2027['2027-05-19'].label).toBe('Cuti Bersama Waisak 2571 BE');
    expect(HOLIDAYS_2027['2027-12-24'].label).toBe('Cuti Bersama Kelahiran Yesus Kristus (Natal)');
  });
  it('menolak pengajuan cuti yang dimulai pada hari libur 2027',()=>{
    const res=calculate({start:'2027-01-01',end:'2027-01-05'},[],2,'2026-11-01');
    expect(res.errors.map(e=>e.code)).toContain('NON_WORKING_DAY');
  });
  it('melewati hari libur di tengah rentang tanpa menghitung durasinya',()=>{
    // 2027-01-04 (Senin kerja), 2027-01-05 (Selasa libur Isra Miraj), 2027-01-06 (Rabu kerja), 2027-01-07 (Kamis kerja), 2027-01-08 (Jumat kerja)
    const res=calculate({start:'2027-01-04',end:'2027-01-08'},[],2,'2026-11-01');
    expect(res.days).toEqual(['2027-01-04','2027-01-06','2027-01-07','2027-01-08']);
    expect(res.duration).toBe(4);
    expect(res.days).not.toContain('2027-01-05');
  });
  it('menghitung tanggal akhir valid dengan melompati libur panjang Idul Fitri & Nyepi Maret 2027',()=>{
    // Mulai 5 Maret 2027 (Jumat). 8-15 Maret adalah Nyepi, Cuti Bersama, Idul Fitri, Cuti Bersama, weekend.
    // Hari kerja berikutnya: 16 (Sel), 17 (Rab), 18 (Kam), 19 (Jum).
    const valid=getValidEndDates('2027-03-05',DEFAULT_CALENDAR);
    expect(valid).toEqual(['2027-03-05','2027-03-16','2027-03-17','2027-03-18','2027-03-19']);
  });
});
