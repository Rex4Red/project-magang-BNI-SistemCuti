import {test,expect} from '@playwright/test';

for(const [role,position,roles] of [
  ['Karyawan','CS_BINA',['EMPLOYEE']],
  ['SDM','SDM',['SDM','EMPLOYEE']],
  ['Admin','BBO',['ADMIN']],
] as const){
  test(`${role} changes their password from profile and signs in again`,async({page},testInfo)=>{
    const email=`profile-${role.toLowerCase()}@demo.bni.local`;
    const headers={'X-Cuti-Client':'web'};
    const adminLogin=await page.request.post('/api/login',{headers,data:{email:'admin@demo.bni.local',password:'BniCuti!2026'}});expect(adminLogin.ok()).toBe(true);
    const created=await page.request.post('/api/admin/employee',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{name:`Profil Uji ${role}`,email,phone:'081234567899',position,roles,active:true,password:'abc123'}});expect(created.ok()).toBe(true);
    await page.request.post('/api/logout',{headers});
    await page.goto('/');await page.getByLabel('Email karyawan').fill(email);await page.getByLabel('Kata sandi',{exact:true}).fill('abc123');await page.getByRole('button',{name:'Masuk',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Ringkasan',exact:true})).toBeVisible();
    if(role==='SDM')await page.getByRole('dialog',{name:'Pengajuan menunggu review',exact:true}).getByRole('button',{name:'Tutup',exact:true}).click();
    await page.getByRole('button',{name:'Profil saya',exact:true}).click();
    await page.getByRole('button',{name:'Ganti kata sandi',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Ganti kata sandi',exact:true});
    await dialog.getByLabel('Kata sandi saat ini',{exact:true}).fill('wrong123');
    const next=dialog.getByLabel('Kata sandi baru',{exact:true});
    await next.fill('abcdef');expect(await next.evaluate((el:HTMLInputElement)=>el.checkValidity())).toBe(false);
    await next.fill('def456');await dialog.getByLabel('Konfirmasi kata sandi baru',{exact:true}).fill('def456');
    await dialog.getByRole('button',{name:'Simpan kata sandi',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Kata sandi saat ini tidak sesuai.');
    await dialog.getByLabel('Kata sandi saat ini',{exact:true}).fill('abc123');await dialog.getByLabel('Konfirmasi kata sandi baru',{exact:true}).fill('ghi789');
    await dialog.getByRole('button',{name:'Simpan kata sandi',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Konfirmasi kata sandi baru tidak sama.');
    await dialog.getByLabel('Konfirmasi kata sandi baru',{exact:true}).fill('def456');
    if(role==='Admin'){
      await page.setViewportSize({width:390,height:844});
      expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath('change-password-mobile.png')});
    }
    await dialog.getByRole('button',{name:'Simpan kata sandi',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Kata sandi berhasil diubah.');
    await page.getByRole('button',{name:'Keluar dari akun',exact:true}).click();
    await page.getByLabel('Email karyawan').fill(email);await page.getByLabel('Kata sandi',{exact:true}).fill('abc123');await page.getByRole('button',{name:'Masuk',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Email atau kata sandi tidak sesuai.');
    await page.getByLabel('Kata sandi',{exact:true}).fill('def456');await page.getByRole('button',{name:'Masuk',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Ringkasan',exact:true})).toBeVisible();
    if(role==='SDM')await page.getByRole('dialog',{name:'Pengajuan menunggu review',exact:true}).getByRole('button',{name:'Tutup',exact:true}).click();
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button',{name:'Profil saya',exact:true}).click();
    await page.getByRole('button',{name:'Ganti kata sandi',exact:true}).click();
    await expect(dialog.getByLabel('Kata sandi saat ini',{exact:true})).toHaveValue('');
    await expect(dialog.getByLabel('Kata sandi baru',{exact:true})).toHaveValue('');
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  });
}
