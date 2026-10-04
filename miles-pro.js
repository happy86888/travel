/* ============================================================
 * miles-pro.js — 全球哩程試算引擎（單程、每人）
 * 數字來源：2026-10 研究報告（27 個哩程計畫官方兌換表／第三方彙整）
 *  - worldwide-ffp-chart-logic-20261003-1633/report.md（26 計畫）
 *  - tpe-routes-gapfill-research-20261003-1629/report.md（補充查核）
 *  - lifemiles-chart-research-20261003-1717/report.md（LifeMiles）
 * 機場座標：travel-site/airports_curated.json（136 機場，禁止自編）
 * 規則：分區固定制照表查；距離帶制先算大圓距離再對帶；
 *       動態制顯示「研究依據下限＋（動態、需驗證）」；
 *       無可靠下限顯示「待查（動態、需驗證）」；其餘未知顯示「待查」。
 * 來回＝單程 × 2（ANA 等季節制以淡季為基準，見各計畫註記）。
 * ============================================================ */
'use strict';

/* ---------- 大圓距離（英里） ---------- */
function gcMiles(a, b) {
  const A = AIRPORTS[a], B = AIRPORTS[b];
  if (!A || !B) return null;
  const R = 3958.8; // 地球半徑（英里）
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(B.lat - A.lat), dLon = toRad(B.lon - A.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(A.lat)) * Math.cos(toRad(B.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- 區域分類 ---------- */
const RG = {
  TW:   ['TPE','TSA','KHH','RMQ','TTT'],
  HKMO: ['HKG','MFM'],
  CN:   ['CAN','SZX','XMN','FOC','HGH','PVG','SHA','NKG','NGB','TAO','WUH','CGO','CTU','TFU','CKG','PEK','PKX'],
  JP:   ['NRT','HND','KIX','NGO','CTS','SDJ','FUK','OKA','KOJ','KMJ','TAK','TOY','HIJ','HKD','AKJ','AOJ','ISG','MYJ','SHM','KMI','KKJ'],
  KR:   ['ICN','GMP','PUS','CJU','TAE','CJJ'],
  SEA:  ['SIN','KUL','PEN','BKI','BKK','DMK','CNX','HKT','SGN','HAN','DAD','PQC','MNL','CRK','CEB','CGK','DPS','PNH','RGN','BWN'],
  SA:   ['DEL'],
  ME:   ['DXB','AUH','DOH','IST','SAW','CAI'],
  EU:   ['LHR','LGW','CDG','ORY','FRA','MUC','AMS','VIE','MXP','FCO','PRG','MAD','BCN','LIS','ZRH','GVA','ARN','CPH','HEL','OSL','BRU','DUB','MAN','EDI','ATH'],
  NA:   ['LAX','SFO','SEA','ONT','PHX','JFK','EWR','ORD','IAH','DFW','IAD','YYZ','YVR','ANC','MEX'],
  SAM:  ['GRU','EZE','LIM','BOG'],
  OC:   ['AKL','SYD','MEL','BNE','PER','CNS'],
  AF:   ['JNB','CPT','NBO','ADD','CMN','RAK'],
  ISL:  ['GUM','HNL']
};
const _RMAP = {};
for (const r of Object.keys(RG)) for (const c of RG[r]) _RMAP[c] = r;
function regionOf(code) { return _RMAP[code] || null; }
const ASIA = ['TW','HKMO','CN','JP','KR','SEA','SA'];
const inAsia = c => ASIA.includes(regionOf(c));

/* ---------- 小工具 ---------- */
function _bandLE(dist, bands) {
  // bands: [[上限(含), eco, biz], ...]，上限由小到大
  for (const b of bands) if (dist <= b[0]) return { eco: b[1], biz: b[2] };
  return null;
}
function _other(o, d, set) { return set.includes(o) ? d : o; }

/* ============================================================
 * 27 個哩程計畫
 * calc(distMi, orig, dest) → {eco, biz, dyn?} | null
 *   eco/biz：單程每人點數；null＝無該艙等／無資料
 *   dyn=true：數字為動態下限，顯示時加「（動態、需驗證）」
 * ============================================================ */
const PROGRAMS = [

/* ---- 1. 長榮航空 Infinity MileageLands（星空聯盟，分區固定制） ---- */
{ id:'eva', name:'長榮航空', sub:'無限萬哩遊・星空聯盟', note:'固定制；收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(!ro||!rd) return null;
    const tw=r=>r==='TW', hkmo=r=>r==='HKMO';
    if((tw(ro)&&hkmo(rd))||(hkmo(ro)&&tw(rd))) return {eco:10000,biz:null};
    if(inAsia(o)&&inAsia(d)) return {eco:17500,biz:20000};
    if(inAsia(o)!==inAsia(d)){
      const nr=inAsia(o)?rd:ro;
      if(nr==='OC') return {eco:50000,biz:null};
      if(nr==='NA'){
        const hi=['ORD','JFK','IAH','YYZ'].includes(o)||['ORD','JFK','IAH','YYZ'].includes(d);
        return hi?{eco:55000,biz:60000}:{eco:50000,biz:55000};
      }
      if(nr==='EU') return {eco:50000,biz:55000};
    }
    return null;
  } },

/* ---- 2. 中華航空 Dynasty（天合聯盟，2026/9/16 動態三段制：顯示充足級距下限） ---- */
{ id:'ci', name:'中華航空', sub:'華夏哩程・天合聯盟', note:'2026/9/16 新制三段動態價，顯示「充足」級距下限；收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(!ro||!rd) return null;
    const A1=['HKG','MFM','XMN','FOC'];
    const A3=['NRT','HND','KIX','CTS','ICN','GMP','BKK','CNX','PEN','DPS','RGN'];
    const nyc=c=>c==='JFK'||c==='EWR';
    let eco=null,biz=null;
    const twIn=ro==='TW'||rd==='TW';
    if(twIn&&inAsia(o)&&inAsia(d)){
      const other=ro==='TW'?d:o;
      if(A1.includes(other)){eco=9000;biz=25000;}
      else if(A3.includes(other)){eco=17500;biz=30000;}
      else{eco=15000;biz=27500;}
    }
    else if(inAsia(o)&&inAsia(d)){eco=17500;biz=30000;}
    else if(ro==='OC'&&rd==='OC'){eco=15000;biz=30000;}
    else if(inAsia(o)!==inAsia(d)){
      const nr=inAsia(o)?rd:ro;
      if(nr==='OC'){eco=40000;biz=75000;}
      else if(nr==='NA'){ if(nyc(o)||nyc(d)){eco=45000;biz=80000;} else {eco=40000;biz=80000;} }
      else if(nr==='EU'){eco=45000;biz=80000;}
      else return null;
    }
    else return null;
    return {eco,biz,dyn:true};
  } },

/* ---- 3. 星宇航空 COSMILE（2026/10/1 調漲後，分區固定制） ---- */
{ id:'jx', name:'星宇航空', sub:'COSMILE', note:'固定制（2026/10/1 調漲後）；一般不收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(!ro||!rd) return null;
    const tw=r=>r==='TW', hkmo=r=>r==='HKMO';
    if((tw(ro)&&hkmo(rd))||(hkmo(ro)&&tw(rd))) return {eco:10000,biz:20000};
    if(inAsia(o)&&inAsia(d)) return {eco:17500,biz:30000};
    if(inAsia(o)!==inAsia(d)){
      const nr=inAsia(o)?rd:ro;
      if(nr==='NA'||nr==='EU') return {eco:50000,biz:90000};
    }
    return null;
  } },

/* ---- 4. 泰國航空 Royal Orchid Plus（星空聯盟，分區固定制・曼谷出發表） ---- */
{ id:'tg', name:'泰國航空', sub:'Royal Orchid Plus・星空聯盟', note:'固定制（曼谷出發分區表）；收燃油附加費',
  calc(dist,o,d){
    const TH=['BKK','DMK','CNX','HKT'];
    const thIn=TH.includes(o)||TH.includes(d);
    if(!thIn) return null;
    const other=_other(o,d,TH);
    const r=regionOf(other);
    if(['SIN','KUL','HAN'].includes(other)) return {eco:16250,biz:25000};
    if(['TW','CN','HKMO'].includes(r)) return {eco:21250,biz:35000};
    if(['CGK','DPS','MNL','CEB','CRK'].includes(other)) return {eco:21250,biz:32500};
    if(other==='DEL') return {eco:21250,biz:32500};
    if(r==='JP'||r==='KR'||other==='PEK'||other==='PKX') return {eco:26250,biz:52500};
    if(['DXB','AUH','DOH'].includes(other)) return {eco:26250,biz:47500};
    if(['SYD','MEL','BNE'].includes(other)) return {eco:31250,biz:70000};
    if(other==='PER') return {eco:26250,biz:52500};
    if(other==='AKL') return {eco:46250,biz:90000};
    if(r==='EU') return {eco:49000,biz:89000};
    return null;
  } },

/* ---- 5. 越南航空 Lotusmiles（天合聯盟，分區固定制・淡季基準） ---- */
{ id:'vn', name:'越南航空', sub:'Lotusmiles・天合聯盟', note:'固定制（淡季基準）；收燃油附加費',
  calc(dist,o,d){
    const VN=['SGN','HAN','DAD','PQC'];
    const vnIn=VN.includes(o)||VN.includes(d);
    if(!vnIn) return null;
    const other=_other(o,d,VN);
    const r=regionOf(other);
    if(r==='SEA') return {eco:11000,biz:35000};
    if(['TW','CN','HKMO'].includes(r)) return {eco:18000,biz:50000};
    if(r==='KR') return {eco:20000,biz:60000};
    if(r==='JP') return {eco:35000,biz:90000};
    if(r==='SA') return {eco:25000,biz:60000};
    if(r==='OC') return {eco:40000,biz:150000};
    if(r==='EU') return {eco:45000,biz:160000};
    if(r==='NA') return {eco:55000,biz:250000};
    return null;
  } },

/* ---- 6. 大韓航空 SKYPASS（天合聯盟，分區固定制・淡季基準） ---- */
{ id:'ke', name:'大韓航空', sub:'SKYPASS・天合聯盟', note:'固定制（淡季基準；旺季約 +50%）；收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    const nea=['TW','JP','KR','CN','HKMO'];
    if(nea.includes(ro)&&nea.includes(rd)) return {eco:15000,biz:22500};
    return null;
  } },

/* ---- 7. 韓亞航空 Asiana Club（星空聯盟，分區固定制） ---- */
{ id:'oz', name:'韓亞航空', sub:'Asiana Club・星空聯盟', note:'固定制；2026/12/16 退出星盟併入大韓；收燃油附加費',
  calc(dist,o,d){
    const KR4=['ICN','GMP','PUS','CJU','TAE','CJJ'];
    const kIn=KR4.includes(o)||KR4.includes(d);
    if(!kIn) return null;
    const other=_other(o,d,KR4);
    const r=regionOf(other);
    if(['JP','CN','TW','HKMO'].includes(r)) return {eco:15000,biz:22500};
    if(r==='SEA') return {eco:20000,biz:30000};
    if(r==='SA') return {eco:25000,biz:37500};
    if(r==='NA'||r==='OC') return {eco:35000,biz:52500};
    if(r==='EU') return {eco:35000,biz:52500};
    return null;
  } },

/* ---- 8. 日本航空 JAL Mileage Bank（寰宇一家，分區固定制） ---- */
{ id:'jl', name:'日本航空', sub:'JAL Mileage Bank・寰宇一家', note:'固定制；收燃油附加費（稅費高）；東南亞線取最低',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(ro!=='JP'&&rd!=='JP') return null;
    const other=ro==='JP'?d:o;
    if((o==='OKA'&&d==='TPE')||(o==='TPE'&&d==='OKA')) return {eco:7500,biz:null}; // JTA 日空執飛，無商務艙
    if(['TPE','TSA','KHH','RMQ','TTT'].includes(other)) return {eco:10000,biz:24000};
    if(['ICN','GMP','PUS','CJU'].includes(other)) return {eco:7500,biz:18000};
    if(['LAX','SFO','SEA','ONT','PHX','JFK','EWR','ORD','IAH','DFW','IAD'].includes(other)) return {eco:27000,biz:55000};
    if(['LHR','LGW','CDG','ORY'].includes(other)) return {eco:27000,biz:57000};
    if(['HEL','FRA'].includes(other)) return {eco:23000,biz:55000};
    if(other==='HNL') return {eco:20000,biz:43000};
    if(['BKK','SIN','KUL','CGK','HAN'].includes(other)) return {eco:12000,biz:40000};
    return null;
  } },

/* ---- 9. 全日空 ANA Mileage Club（星空聯盟，分區＋季節制・淡季基準） ---- */
{ id:'nh', name:'全日空 ANA', sub:'ANA Mileage Club・星空聯盟', note:'固定制（淡季基準）；歐洲／大洋洲為推算值；收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(ro!=='JP'&&rd!=='JP') return null;
    const other=ro==='JP'?d:o;
    const r=regionOf(other);
    if(['ICN','GMP','PUS','CJU'].includes(other)) return {eco:6000,biz:12500};
    if(['TPE','TSA','KHH','HKG','MFM'].includes(other)) return {eco:8500,biz:17500};
    if(r==='SEA') return {eco:15000,biz:27500};
    if(other==='HNL') return {eco:17500,biz:30000};
    if(r==='NA') return {eco:20000,biz:50000};
    if(r==='EU') return {eco:22500,biz:40000};
    if(r==='OC') return {eco:18500,biz:32500};
    return null;
  } },

/* ---- 10. 新加坡航空 KrisFlyer（星空聯盟，分區固定制・2025/11 新制 Saver） ---- */
{ id:'sq', name:'新加坡航空', sub:'KrisFlyer・星空聯盟', note:'固定制（2025/11 新制 Saver）；有燃油附加費',
  calc(dist,o,d){
    if(o!=='SIN'&&d!=='SIN') return null;
    const other=o==='SIN'?d:o;
    const r=regionOf(other);
    if(other==='TPE') return {eco:15500,biz:35500};
    if(r==='EU') return {eco:44000,biz:null};
    if(['LAX','SFO','SEA'].includes(other)) return {eco:null,biz:112500};
    if(['JFK','EWR','ORD','IAH'].includes(other)) return {eco:null,biz:117000};
    if(other==='IST'||other==='DXB') return {eco:32000,biz:null};
    return null;
  } },

/* ---- 11. 汶萊皇家航空 Royal Skies（分區固定制・Saver 基準） ---- */
{ id:'bi', name:'汶萊皇家航空', sub:'Royal Skies', note:'固定制（Saver 基準）',
  calc(dist,o,d){
    const bIn=o==='BWN'||d==='BWN';
    if(!bIn) return null;
    const other=o==='BWN'?d:o;
    if(regionOf(other)==='TW') return {eco:15000,biz:30000};
    return null;
  } },

/* ---- 12. 馬來西亞航空 Enrich（寰宇一家，動態制・無可靠下限） ---- */
{ id:'mh', name:'馬來西亞航空', sub:'Enrich・寰宇一家', note:'收益制動態定價，無可靠固定數字',
  calc(){ return {eco:null,biz:null,dyn:true}; } },

/* ---- 13. 聯合航空 MileagePlus（星空聯盟，動態制） ---- */
{ id:'ua', name:'聯合航空', sub:'MileagePlus・星空聯盟', note:'全面動態，顯示常見下限；不收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(ro!=='NA'&&rd!=='NA') return null;
    const other=ro==='NA'?d:o;
    const r=regionOf(other);
    if(r==='EU') return {eco:30000,biz:60000,dyn:true};
    if(ASIA.includes(r)) return {eco:55000,biz:100000,dyn:true};
    if(r==='OC'||r==='AF') return {eco:40000,biz:80000,dyn:true};
    return null;
  } },

/* ---- 14. 達美航空 SkyMiles（天合聯盟，動態制） ---- */
{ id:'dl', name:'達美航空', sub:'SkyMiles・天合聯盟', note:'全面動態，顯示常見下限；自營不收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if(ro!=='NA'&&rd!=='NA') return null;
    const other=ro==='NA'?d:o;
    const r=regionOf(other);
    if(r==='EU') return {eco:35000,biz:95000,dyn:true};
    if(['JP','KR','TW','CN','HKMO'].includes(r)) return {eco:40000,biz:102500,dyn:true};
    return null;
  } },

/* ---- 15. 漢莎航空 Miles&More（星空聯盟，2025/6/3 自營改動態） ---- */
{ id:'lh', name:'漢莎航空', sub:'Miles&More・星空聯盟', note:'自營動態（顯示跨大西洋下限）；燃油附加費極高',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    if((ro==='EU'&&rd==='NA')||(ro==='NA'&&rd==='EU')) return {eco:15000,biz:60000,dyn:true};
    return null;
  } },

/* ---- 16. 法航荷航 Flying Blue（天合聯盟，動態制） ---- */
{ id:'fb', name:'法國航空／荷蘭航空', sub:'Flying Blue・天合聯盟', note:'動態定價，顯示基準下限；收燃油附加費',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    const EA=['TPE','TSA','NRT','HND','KIX','ICN','GMP','HKG','SIN'];
    const ac=c=>c==='AMS'||c==='CDG';
    if((EA.includes(o)&&ac(d))||(EA.includes(d)&&ac(o))) return {eco:30000,biz:85000,dyn:true};
    if(ro==='EU'&&rd==='EU') return {eco:10000,biz:25000,dyn:true};
    if(ro&&rd&&ro!==rd) return {eco:25000,biz:60000,dyn:true};
    return null;
  } },

/* ---- 17. 阿聯酋航空 Skywards（動態制・2026/5 改制後無可靠下限） ---- */
{ id:'ek', name:'阿聯酋航空', sub:'Skywards', note:'2026/5/20 改制，確切數字以官網計算器為準',
  calc(){ return {eco:null,biz:null,dyn:true}; } },

/* ---- 18. 土耳其航空 Miles&Smiles（星空聯盟，分區固定制・改制過渡期） ---- */
{ id:'tk', name:'土耳其航空', sub:'Miles&Smiles・星空聯盟', note:'改制過渡期（舊表）；歐洲 1/2 劃分不明不列',
  calc(dist,o,d){
    const TKH=['IST','SAW'];
    const tIn=TKH.includes(o)||TKH.includes(d);
    if(!tIn) return null;
    const other=_other(o,d,TKH);
    const r=regionOf(other);
    if(['JP','KR','TW','CN','HKMO','SEA','SA'].includes(r)) return {eco:55000,biz:140000};
    if(r==='NA') return {eco:55000,biz:135000};
    if(['DXB','AUH','DOH','CAI'].includes(other)) return {eco:23000,biz:45000};
    return null;
  } },

/* ---- 19. 國泰航空 Asia Miles（寰宇一家，距離帶制・2026/5 新制第三方彙整） ---- */
{ id:'cx', name:'國泰航空', sub:'Asia Miles・寰宇一家', note:'距離帶制（2026/5 新制，第三方彙整非官方表）；收燃油附加費',
  calc(dist,o,d){
    const T2=['NRT','HND','KIX','NGO','CTS','CGK','DEL'];
    if(dist<=750) return {eco:7000,biz:16000};
    if(dist<=2750){
      const t2=T2.includes(o)||T2.includes(d);
      return t2?{eco:13000,biz:33000}:{eco:9000,biz:27000};
    }
    if(dist<=5000) return {eco:20000,biz:60000};
    if(dist<=7500) return {eco:27000,biz:91000};
    return {eco:38000,biz:119000};
  } },

/* ---- 20. 英國航空 Executive Club（寰宇一家，Avios 距離帶制） ---- */
{ id:'ba', name:'英國航空', sub:'Executive Club・寰宇一家', note:'Avios 距離帶制；BA 自營收高額燃油附加費',
  calc(dist){
    const B=[[651,6000,12500],[1152,9000,16500],[2001,11000,22000],[3001,13000,38750],
             [4001,20750,62000],[5501,25750,77250],[6501,31000,92750],[7001,36250,108250],
             [Infinity,51500,154500]];
    return _bandLE(dist,B);
  } },

/* ---- 21. 阿提哈德航空 Etihad Guest（距離帶制） ---- */
{ id:'ey', name:'阿提哈德航空', sub:'Etihad Guest', note:'自營距離帶制（2,501–3,000 英里帶未確認）',
  calc(dist){
    if(dist<=500) return {eco:5000,biz:15000};
    if(dist<=1000) return {eco:10000,biz:20000};
    if(dist<=1500) return {eco:13000,biz:30000};
    if(dist<=2000) return {eco:15000,biz:35000};
    if(dist<=2500) return {eco:20000,biz:45000};
    if(dist<=3000) return null;
    if(dist<=4000) return {eco:30000,biz:70000};
    if(dist<=5000) return {eco:37000,biz:75000};
    if(dist<=6000) return {eco:45000,biz:95000};
    return {eco:60000,biz:120000};
  } },

/* ---- 22. 卡達航空 Privilege Club（寰宇一家，Avios 距離帶制） ---- */
{ id:'qr', name:'卡達航空', sub:'Privilege Club・寰宇一家', note:'Avios 距離帶制；自營不收燃油附加費',
  calc(dist){
    const B=[[650,6000,12500],[1151,9000,16500],[2000,11000,22000],[3000,13000,34000],
             [4000,18000,42500],[5500,24000,50000],[6500,30500,63750],[7000,34000,72250],
             [Infinity,42500,85000]];
    return _bandLE(dist,B);
  } },

/* ---- 23. 阿拉斯加航空 Atmos Rewards（寰宇一家，夥伴距離帶制） ---- */
{ id:'as', name:'阿拉斯加航空', sub:'Atmos Rewards・寰宇一家', note:'夥伴距離帶制（起價）；單程可免費中停一次',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    const ap=r=>['TW','HKMO','CN','JP','KR','SEA','SA','OC'].includes(r);
    const eu=r=>['EU','ME','AF'].includes(r);
    let B;
    if(ap(ro)||ap(rd)) B=[[1500,7500,15000],[3000,25000,50000],[5000,30000,60000],[7000,37500,75000],[10000,42500,85000],[Infinity,65000,130000]];
    else if(eu(ro)||eu(rd)) B=[[1500,7500,15000],[3500,22500,45000],[5000,27500,55000],[7000,35000,70000],[10000,42500,85000],[Infinity,55000,110000]];
    else B=[[700,4500,9000],[1400,7500,15000],[2100,12500,25000],[4000,17500,35000],[6000,25000,50000],[Infinity,30000,60000]];
    return _bandLE(dist,B);
  } },

/* ---- 24. 美國航空 AAdvantage（寰宇一家，夥伴分區固定制・美加出發） ---- */
{ id:'aa', name:'美國航空', sub:'AAdvantage・寰宇一家', note:'夥伴固定制（美加出發）；多不收燃油附加費',
  calc(dist,o,d){
    const NA2=['LAX','SFO','SEA','ONT','PHX','JFK','EWR','ORD','IAH','DFW','IAD','YYZ','YVR','ANC'];
    const naIn=NA2.includes(o)||NA2.includes(d);
    if(!naIn) return null;
    const other=NA2.includes(o)?d:o;
    const r=regionOf(other);
    if(NA2.includes(other)) return {eco:12500,biz:25000};
    if(r==='EU') return {eco:30000,biz:57500};
    if(r==='JP'||r==='KR') return {eco:35000,biz:60000};
    if(other==='DEL'||['DXB','AUH','DOH','IST','SAW'].includes(other)) return {eco:40000,biz:70000};
    if(r==='AF') return {eco:40000,biz:75000};
    if(r==='OC') return {eco:40000,biz:80000};
    if(other==='HNL') return {eco:22500,biz:55000};
    if(['TW','HKMO','CN','SEA','SA'].includes(r)) return {eco:37500,biz:70000};
    return null;
  } },

/* ---- 25. 加拿大航空 Aeroplan（星空聯盟，2026/6/1 夥伴距離帶制） ---- */
{ id:'ac', name:'加拿大航空', sub:'Aeroplan・星空聯盟', note:'2026/6/1 夥伴距離表；不收／極低燃油附加費；亞洲短程 8,000 為用戶實測',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    const NA=['LAX','SFO','SEA','ONT','PHX','JFK','EWR','ORD','IAH','DFW','IAD','YYZ','YVR','ANC','MEX','GUM','HNL'];
    const ATL=['EU','ME','AF'];
    const PACAS=['TW','HKMO','CN','JP','KR','SEA','SA'];
    const inNA=r=>['LAX','SFO','SEA','ONT','PHX','JFK','EWR','ORD','IAH','DFW','IAD','YYZ','YVR','ANC','MEX','GUM','HNL'].includes(r);
    const oNA=inNA(o), dNA=inNA(d);
    if(oNA&&dNA) return null;
    if(oNA||dNA){
      const other=oNA?d:o;
      const r=regionOf(other);
      if(ATL.includes(r)){
        if(dist<=4000) return {eco:32500,biz:null};
        if(dist<=6000) return {eco:42500,biz:75000};
        if(dist<=8000) return {eco:null,biz:90000};
        return null;
      }
      if(PACAS.includes(r)||r==='OC'){
        if(dist<=7500) return null;
        if(dist<=11000) return {eco:null,biz:102500};
        return {eco:70000,biz:null};
      }
      return null;
    }
    if(ro==='EU'&&rd==='EU'){
      if(dist<1000) return {eco:null,biz:12500};
      if(dist<=2000) return {eco:null,biz:22500};
      return null;
    }
    if(PACAS.includes(ro)&&PACAS.includes(rd)){
      if(dist<1000) return {eco:8000,biz:null,user:true}; // 用戶實測（如 TPE–FUK）
      if(dist<=2000) return {eco:15000,biz:null};
      if(dist<=5000) return {eco:30000,biz:null};
      return null;
    }
    return null;
  } },

/* ---- 26. 維珍航空 Virgin Atlantic Flying Club（天合聯盟，夥伴距離帶制） ---- */
{ id:'vs', name:'維珍航空', sub:'Flying Club・天合聯盟', note:'天合夥伴距離制；另有 ANA 專表',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    const USW=['LAX','SFO','SEA','ONT','PHX'], USE=['ORD','IAH','DFW','IAD','JFK','EWR'];
    const jw=(USW.includes(o)&&rd==='JP')||(USW.includes(d)&&ro==='JP');
    const je=(USE.includes(o)&&rd==='JP')||(USE.includes(d)&&ro==='JP');
    const jh=((o==='HNL'&&rd==='JP')||(d==='HNL'&&ro==='JP'));
    if(jw) return {eco:null,biz:52500};
    if(je) return {eco:null,biz:60000};
    if(jh) return {eco:null,biz:37500};
    const B=[[500,5500,14500],[1000,7000,15500],[1500,10000,21500],[2250,11500,35000],
             [3000,15500,40000],[4000,20500,60000],[5000,25500,75000],[6000,31000,85000],
             [7000,37000,100000],[12000,50000,140000],[Infinity,null,null]];
    for(const b of B){ if(dist<=b[0]) return (b[1]==null&&b[2]==null)?null:{eco:b[1],biz:b[2]}; }
    return null;
  } },

/* ---- 27. 澳航 Qantas Frequent Flyer（寰宇一家，Classic 距離制・代表航線） ---- */
{ id:'qf', name:'澳洲航空', sub:'Qantas Frequent Flyer・寰宇一家', note:'Classic 固定制（僅收錄已驗證代表航線）；收高額燃油附加費',
  calc(dist,o,d){
    const pair=(a,b)=>(o===a&&d===b)||(o===b&&d===a);
    if(pair('SYD','MEL')) return {eco:9200,biz:19300};
    if(pair('SYD','AKL')) return {eco:null,biz:43600};
    if(pair('SYD','LHR')) return {eco:null,biz:166300};
    return null;
  } },

/* ---- 28. Avianca LifeMiles（星空聯盟，隱性分區浮動制・顯示區間下限） ---- */
{ id:'lm', name:'Avianca 哥倫比亞航空', sub:'LifeMiles・星空聯盟', note:'隱性分區浮動制，顯示區間下限；原則不收燃油附加費；亞洲區內短程待查',
  calc(dist,o,d){
    const ro=regionOf(o), rd=regionOf(d);
    const USC=['LAX','SFO','SEA','ONT','PHX','JFK','EWR','ORD','IAH','DFW','IAD','ANC'];
    const us=c=>USC.includes(c);
    const usIn=us(o)||us(d);
    const NEA=['JP','KR','CN','TW'];
    if(usIn){
      const other=us(o)?d:o;
      const r=regionOf(other);
      if(r==='EU') return {eco:35000,biz:63000,dyn:true};
      if(NEA.includes(r)) return {eco:40000,biz:85000,dyn:true};
      if(r==='SA'||r==='SEA') return {eco:42000,biz:90000,dyn:true};
      if(r==='OC') return {eco:45000,biz:90000,dyn:true};
      if(r==='ME'||r==='AF') return {eco:42000,biz:78000,dyn:true};
      return null;
    }
    if((ro==='EU'&&ASIA.includes(rd))||(rd==='EU'&&ASIA.includes(ro)))
      return {eco:35000,biz:63000,dyn:true};
    return null;
  } }

];

/* ---------- 主函式 ---------- */
/**
 * computeMile(progId, orig, dest)
 * @returns null（無資料／機場無效／同機場）
 *          或 {eco, biz, dyn, dist}
 *          eco/biz：單程每人點數（null＝無該艙等或無可靠數字）
 *          dyn=true：數字為動態下限，顯示加「（動態、需驗證）」
 *          dist：大圓距離（英里，四捨五入）
 */
'use strict';

const AIRPORTS={
"TPE":{n:"Taiwan Taoyuan International Airport",c:"Taoyuan",zh:"台北",lat:25.0777,lon:121.233},
"TSA":{n:"Taipei Songshan International Airport",c:"Taipei (Songshan)",zh:"台北（松山）",lat:25.0672,lon:121.5528},
"KHH":{n:"Kaohsiung International Airport",c:"Kaohsiung (Xiaogang)",zh:"高雄",lat:22.5771,lon:120.35},
"RMQ":{n:"Taichung International Airport / Ching Chuang Kang Air Base",c:"Taichung (Qingshui)",zh:"台中",lat:24.2647,lon:120.621},
"TTT":{n:"Taitung Airport",c:"Taitung City",zh:"台東",lat:22.7549,lon:121.1018},
"NRT":{n:"Narita International Airport",c:"Narita",zh:"東京（成田）",lat:35.7686,lon:140.3887},
"HND":{n:"Tokyo Haneda International Airport",c:"Tokyo",zh:"東京（羽田）",lat:35.5497,lon:139.787},
"KIX":{n:"Kansai International Airport",c:"Osaka",zh:"大阪",lat:34.4273,lon:135.244},
"NGO":{n:"Chubu Centrair International Airport",c:"Tokoname",zh:"名古屋",lat:34.8584,lon:136.805},
"CTS":{n:"New Chitose Airport",c:"Sapporo",zh:"札幌",lat:42.7748,lon:141.6904},
"SDJ":{n:"Sendai Airport",c:"Natori",zh:"仙台",lat:38.1397,lon:140.917},
"FUK":{n:"Fukuoka Airport",c:"Fukuoka",zh:"福岡",lat:33.5859,lon:130.451},
"OKA":{n:"Naha International Airport",c:"Naha",zh:"沖繩（那霸）",lat:26.1924,lon:127.6398},
"KOJ":{n:"Kagoshima Airport",c:"Kagoshima",zh:"鹿兒島",lat:31.8034,lon:130.719},
"KMJ":{n:"Kumamoto Airport",c:"Kumamoto",zh:"熊本",lat:32.8373,lon:130.855},
"TAK":{n:"Takamatsu Airport",c:"Takamatsu",zh:"高松",lat:34.215,lon:134.0155},
"TOY":{n:"Toyama Kitokito Airport",c:"Toyama",zh:"富山",lat:36.6484,lon:137.1874},
"HIJ":{n:"Hiroshima Airport",c:"Hiroshima",zh:"廣島",lat:34.4361,lon:132.919},
"HKD":{n:"Hakodate Airport",c:"Hakodate",zh:"函館",lat:41.77,lon:140.822},
"AKJ":{n:"Asahikawa Airport",c:"Higashikagura",zh:"旭川",lat:43.6708,lon:142.447},
"AOJ":{n:"Aomori Airport",c:"Aomori",zh:"青森",lat:40.7338,lon:140.6895},
"ISG":{n:"New Ishigaki Airport",c:"Ishigaki",zh:"石垣",lat:24.3964,lon:124.245},
"MYJ":{n:"Matsuyama Airport",c:"Matsuyama",zh:"松山（日本）",lat:33.8269,lon:132.7001},
"SHM":{n:"Nanki Shirahama Airport",c:"Shirahama",zh:"白濱",lat:33.6622,lon:135.364},
"KMI":{n:"Miyazaki Airport",c:"Miyazaki",zh:"宮崎",lat:31.8772,lon:131.449},
"KKJ":{n:"Kitakyushu Airport",c:"Kitakyushu",zh:"北九州",lat:33.8459,lon:131.035},
"ICN":{n:"Incheon International Airport",c:"Seoul",zh:"首爾（仁川）",lat:37.4691,lon:126.451},
"GMP":{n:"Seoul Gimpo International Airport",c:"Seoul",zh:"首爾（金浦）",lat:37.5583,lon:126.791},
"PUS":{n:"Gimhae International Airport",c:"Busan",zh:"釜山",lat:35.1795,lon:128.938},
"CJU":{n:"Jeju International Airport",c:"Jeju City",zh:"濟州",lat:33.5121,lon:126.4925},
"TAE":{n:"Daegu International Airport",c:"Daegu",zh:"大邱",lat:35.8944,lon:128.657},
"CJJ":{n:"Cheongju International Airport/Cheongju Air Base (K-59/G-513)",c:"Cheongju",zh:"清州",lat:36.7156,lon:127.5003},
"HKG":{n:"Hong Kong International Airport",c:"Hong Kong",zh:"香港",lat:22.3118,lon:113.9149},
"MFM":{n:"Macau International Airport",c:"Nossa Senhora do Carmo",zh:"澳門",lat:22.1496,lon:113.592},
"CAN":{n:"Guangzhou Baiyun International Airport",c:"Guangzhou (Huadu)",zh:"廣州",lat:23.3924,lon:113.299},
"SZX":{n:"Shenzhen Bao'an International Airport",c:"Shenzhen",zh:"深圳",lat:22.6395,lon:113.8033},
"XMN":{n:"Xiamen Gaoqi International Airport",c:"Xiamen",zh:"廈門",lat:24.5439,lon:118.1275},
"FOC":{n:"Fuzhou Changle International Airport",c:"Fuzhou (Changle)",zh:"福州",lat:25.9293,lon:119.6725},
"HGH":{n:"Hangzhou Xiaoshan International Airport",c:"Hangzhou",zh:"杭州",lat:30.2361,lon:120.4289},
"PVG":{n:"Shanghai Pudong International Airport",c:"Shanghai (Pudong)",zh:"上海（浦東）",lat:31.1434,lon:121.805},
"SHA":{n:"Shanghai Hongqiao International Airport",c:"Shanghai (Minhang)",zh:"上海（虹橋）",lat:31.1981,lon:121.3343},
"NKG":{n:"Nanjing Lukou International Airport",c:"Nanjing",zh:"南京",lat:31.735,lon:118.8659},
"NGB":{n:"Ningbo Lishe International Airport",c:"Ningbo",zh:"寧波",lat:29.8267,lon:121.462},
"TAO":{n:"Qingdao Jiaodong International Airport",c:"Qingdao (Jiaozhou)",zh:"青島",lat:36.362,lon:120.0882},
"WUH":{n:"Wuhan Tianhe International Airport",c:"Wuhan (Huangpi)",zh:"武漢",lat:30.7748,lon:114.2137},
"CGO":{n:"Zhengzhou Xinzheng International Airport",c:"Zhengzhou",zh:"鄭州",lat:34.5265,lon:113.8492},
"CTU":{n:"Chengdu Shuangliu International Airport",c:"Chengdu (Shuangliu)",zh:"成都（雙流）",lat:30.5583,lon:103.946},
"TFU":{n:"Chengdu Tianfu International Airport",c:"Chengdu (Jianyang)",zh:"成都（天府）",lat:30.3125,lon:104.4413},
"CKG":{n:"Chongqing Jiangbei International Airport",c:"Chongqing",zh:"重慶",lat:29.7123,lon:106.6519},
"PEK":{n:"Beijing Capital International Airport",c:"Beijing",zh:"北京（首都）",lat:40.0773,lon:116.5967},
"PKX":{n:"Beijing Daxing International Airport",c:"Beijing",zh:"北京（大興）",lat:39.5013,lon:116.414},
"SIN":{n:"Singapore Changi Airport",c:"Singapore",zh:"新加坡",lat:1.3502,lon:103.994},
"KUL":{n:"Kuala Lumpur International Airport",c:"Sepang",zh:"吉隆坡",lat:2.7456,lon:101.71},
"PEN":{n:"Penang International Airport",c:"Penang",zh:"檳城",lat:5.2963,lon:100.2762},
"BKI":{n:"Kota Kinabalu International Airport",c:"Kota Kinabalu",zh:"亞庇",lat:5.9327,lon:116.0493},
"BKK":{n:"Suvarnabhumi Airport",c:"Bangkok",zh:"曼谷（蘇凡納布）",lat:13.6811,lon:100.747},
"DMK":{n:"Don Mueang International Airport",c:"Bangkok",zh:"曼谷（廊曼）",lat:13.9126,lon:100.607},
"CNX":{n:"Chiang Mai International Airport",c:"Chiang Mai",zh:"清邁",lat:18.7668,lon:98.9626},
"HKT":{n:"Phuket International Airport",c:"Phuket",zh:"普吉",lat:8.1133,lon:98.3174},
"SGN":{n:"Tan Son Nhat International Airport",c:"Ho Chi Minh City",zh:"胡志明市",lat:10.8188,lon:106.652},
"HAN":{n:"Noi Bai International Airport",c:"Hanoi (Soc Son)",zh:"河內",lat:21.2212,lon:105.807},
"DAD":{n:"Da Nang International Airport",c:"Da Nang",zh:"峴港",lat:16.0439,lon:108.199},
"PQC":{n:"Phú Quốc International Airport",c:"Phu Quoc Island",zh:"富國島",lat:10.1698,lon:103.9935},
"MNL":{n:"Ninoy Aquino International Airport",c:"Manila (Pasay)",zh:"馬尼拉",lat:14.5086,lon:121.02},
"CRK":{n:"Clark International Airport / Clark Air Base",c:"Mabalacat",zh:"克拉克",lat:15.186,lon:120.56},
"CEB":{n:"Mactan Cebu International Airport",c:"Cebu City/Lapu-Lapu City",zh:"宿霧",lat:10.3093,lon:123.9797},
"CGK":{n:"Soekarno-Hatta International Airport",c:"Jakarta",zh:"雅加達",lat:-6.1256,lon:106.656},
"DPS":{n:"Denpasar I Gusti Ngurah Rai International Airport",c:"Kuta, Badung",zh:"峇里島",lat:-8.7484,lon:115.1671},
"PNH":{n:"Phnom Penh International Airport",c:"Phnom Penh (Pou Senchey)",zh:"金邊",lat:11.5472,lon:104.8447},
"RGN":{n:"Yangon International Airport",c:"Yangon",zh:"仰光",lat:16.9073,lon:96.1332},
"BWN":{n:"Brunei International Airport",c:"Bandar Seri Begawan",zh:"斯里巴加灣",lat:4.9442,lon:114.928},
"DEL":{n:"Indira Gandhi International Airport",c:"New Delhi",zh:"德里",lat:28.5556,lon:77.0952},
"DXB":{n:"Dubai International Airport",c:"Dubai",zh:"杜拜",lat:25.2498,lon:55.371},
"AUH":{n:"Zayed International Airport",c:"Abu Dhabi",zh:"阿布達比",lat:24.441,lon:54.6492},
"DOH":{n:"Hamad International Airport",c:"Doha",zh:"杜哈",lat:25.2731,lon:51.6081},
"IST":{n:"İstanbul Airport",c:"Istanbul",zh:"伊斯坦堡",lat:41.2749,lon:28.7321},
"LHR":{n:"London Heathrow Airport",c:"London",zh:"倫敦（希斯洛）",lat:51.4707,lon:-0.4599},
"LGW":{n:"London Gatwick Airport",c:"London",zh:"倫敦（蓋威克）",lat:51.1487,lon:-0.1857},
"CDG":{n:"Charles de Gaulle International Airport",c:"Paris (Roissy-en-France, Val-d'Oise)",zh:"巴黎（戴高樂）",lat:49.009,lon:2.5541},
"ORY":{n:"Paris-Orly Airport",c:"Paris (Orly, Val-de-Marne)",zh:"巴黎（奧利）",lat:48.7295,lon:2.359},
"FRA":{n:"Frankfurt Main Airport",c:"Frankfurt am Main",zh:"法蘭克福",lat:50.0267,lon:8.5584},
"MUC":{n:"Munich Airport",c:"Munich",zh:"慕尼黑",lat:48.3538,lon:11.7861},
"AMS":{n:"Amsterdam Airport Schiphol",c:"Amsterdam",zh:"阿姆斯特丹",lat:52.3086,lon:4.7639},
"VIE":{n:"Vienna International Airport",c:"Vienna",zh:"維也納",lat:48.1103,lon:16.5697},
"MXP":{n:"Milan Malpensa International Airport",c:"Ferno (VA)",zh:"米蘭",lat:45.6306,lon:8.7281},
"FCO":{n:"Rome–Fiumicino Leonardo da Vinci International Airport",c:"Rome",zh:"羅馬",lat:41.8045,lon:12.252},
"PRG":{n:"Václav Havel Airport Prague",c:"Prague",zh:"布拉格",lat:50.1009,lon:14.2599},
"MAD":{n:"Adolfo Suárez Madrid–Barajas Airport",c:"Madrid",zh:"馬德里",lat:40.4934,lon:-3.5722},
"BCN":{n:"Josep Tarradellas Barcelona-El Prat Airport",c:"Barcelona",zh:"巴塞隆納",lat:41.2971,lon:2.0785},
"LIS":{n:"Lisbon Humberto Delgado Airport",c:"Lisbon",zh:"里斯本",lat:38.7813,lon:-9.1359},
"ZRH":{n:"Zürich Airport",c:"Zurich",zh:"蘇黎世",lat:47.4581,lon:8.5481},
"GVA":{n:"Geneva International Airport",c:"Geneva",zh:"日內瓦",lat:46.2381,lon:6.109},
"ARN":{n:"Stockholm-Arlanda Airport",c:"Stockholm",zh:"斯德哥爾摩",lat:59.6485,lon:17.9288},
"CPH":{n:"Copenhagen Kastrup Airport",c:"Copenhagen",zh:"哥本哈根",lat:55.6179,lon:12.656},
"HEL":{n:"Helsinki Vantaa Airport",c:"Helsinki (Vantaa)",zh:"赫爾辛基",lat:60.3184,lon:24.9633},
"OSL":{n:"Oslo-Gardermoen International Airport",c:"Oslo (Gardermoen)",zh:"奧斯陸",lat:60.1939,lon:11.1004},
"BRU":{n:"Brussels Airport",c:"Zaventem",zh:"布魯塞爾",lat:50.9014,lon:4.4844},
"DUB":{n:"Dublin Airport",c:"Dublin",zh:"都柏林",lat:53.4287,lon:-6.2621},
"MAN":{n:"Manchester Airport",c:"Manchester, Greater Manchester",zh:"曼徹斯特",lat:53.3494,lon:-2.2795},
"EDI":{n:"Edinburgh Airport",c:"Ingliston, Edinburgh",zh:"愛丁堡",lat:55.9501,lon:-3.3723},
"ATH":{n:"Athens Eleftherios Venizelos International Airport",c:"Spata-Artemida",zh:"雅典",lat:37.9364,lon:23.9445},
"SAW":{n:"Istanbul Sabiha Gökçen International Airport",c:"Pendik, Istanbul",zh:"伊斯坦堡（薩比哈）",lat:40.8986,lon:29.3092},
"LAX":{n:"Los Angeles International Airport",c:"Los Angeles",zh:"洛杉磯",lat:33.9425,lon:-118.408},
"SFO":{n:"San Francisco International Airport",c:"San Francisco",zh:"舊金山",lat:37.6198,lon:-122.3748},
"SEA":{n:"Seattle–Tacoma International Airport",c:"Seattle",zh:"西雅圖",lat:47.4479,lon:-122.3103},
"ONT":{n:"Ontario International Airport",c:"Ontario",zh:"安大略",lat:34.056,lon:-117.601},
"PHX":{n:"Phoenix Sky Harbor International Airport",c:"Phoenix",zh:"鳳凰城",lat:33.4353,lon:-112.0059},
"JFK":{n:"John F. Kennedy International Airport",c:"New York",zh:"紐約（甘迺迪）",lat:40.6394,lon:-73.7793},
"EWR":{n:"Newark Liberty International Airport",c:"Newark",zh:"紐約（紐華克）",lat:40.6894,lon:-74.1705},
"ORD":{n:"Chicago O'Hare International Airport",c:"Chicago",zh:"芝加哥",lat:41.9786,lon:-87.9048},
"IAH":{n:"George Bush Intercontinental Airport",c:"Houston",zh:"休士頓",lat:29.9844,lon:-95.3414},
"DFW":{n:"Dallas Fort Worth International Airport",c:"Dallas-Fort Worth",zh:"達拉斯",lat:32.8968,lon:-97.038},
"IAD":{n:"Washington Dulles International Airport",c:"Dulles",zh:"華盛頓",lat:38.9445,lon:-77.4558},
"YYZ":{n:"Toronto Pearson International Airport",c:"Toronto",zh:"多倫多",lat:43.6759,lon:-79.6294},
"YVR":{n:"Vancouver International Airport",c:"Vancouver",zh:"溫哥華",lat:49.1939,lon:-123.184},
"GUM":{n:"Antonio B. Won Pat International Airport",c:"Hagåtña",zh:"關島",lat:13.485,lon:144.7973},
"HNL":{n:"Daniel K. Inouye International Airport",c:"Honolulu, Oahu",zh:"檀香山",lat:21.3184,lon:-157.9257},
"ANC":{n:"Ted Stevens Anchorage International Airport",c:"Anchorage",zh:"安克拉治",lat:61.179,lon:-149.9926},
"MEX":{n:"Mexico City Benito Juárez International Airport",c:"Mexico City",zh:"墨西哥城",lat:19.4358,lon:-99.0703},
"GRU":{n:"São Paulo/Guarulhos–Governor André Franco Montoro International Airport",c:"São Paulo",zh:"聖保羅",lat:-23.4313,lon:-46.47},
"EZE":{n:"Ezeiza International Airport - Ministro Pistarini",c:"Buenos Aires (Ezeiza)",zh:"布宜諾斯艾利斯",lat:-34.8222,lon:-58.5358},
"LIM":{n:"Jorge Chávez International Airport",c:"Lima",zh:"利馬",lat:-12.0219,lon:-77.1143},
"BOG":{n:"El Dorado International Airport",c:"Bogota",zh:"波哥大",lat:4.7016,lon:-74.1469},
"AKL":{n:"Auckland International Airport",c:"Auckland",zh:"奧克蘭",lat:-37.012,lon:174.7863},
"SYD":{n:"Sydney Kingsford Smith International Airport",c:"Sydney (Mascot)",zh:"雪梨",lat:-33.9461,lon:151.177},
"MEL":{n:"Melbourne Airport",c:"Melbourne",zh:"墨爾本",lat:-37.6707,lon:144.8379},
"BNE":{n:"Brisbane International Airport",c:"Brisbane",zh:"布里斯本",lat:-27.3842,lon:153.117},
"PER":{n:"Perth International Airport",c:"Perth",zh:"伯斯",lat:-31.9403,lon:115.967},
"CNS":{n:"Cairns International Airport",c:"Cairns",zh:"凱恩斯",lat:-16.8789,lon:145.7495},
"CAI":{n:"Cairo International Airport",c:"Cairo",zh:"開羅",lat:30.1115,lon:31.3967},
"JNB":{n:"O.R. Tambo International Airport",c:"Johannesburg",zh:"約翰尼斯堡",lat:-26.1401,lon:28.2468},
"CPT":{n:"Cape Town International Airport",c:"Cape Town",zh:"開普敦",lat:-33.974,lon:18.6043},
"NBO":{n:"Jomo Kenyatta International Airport",c:"Nairobi",zh:"奈洛比",lat:-1.3189,lon:36.9282},
"ADD":{n:"Addis Ababa Bole International Airport",c:"Addis Ababa",zh:"阿迪斯阿貝巴",lat:8.9779,lon:38.7993},
"CMN":{n:"Mohammed V International Airport",c:"Casablanca",zh:"卡薩布蘭卡",lat:33.3675,lon:-7.59},
"RAK":{n:"Marrakesh Menara Airport",c:"Marrakesh",zh:"馬拉喀什",lat:31.6048,lon:-8.0358},
};

function computeMile(progId, orig, dest) {
  if (!orig || !dest) return null;
  const o = String(orig).trim().toUpperCase();
  const d = String(dest).trim().toUpperCase();
  if (!AIRPORTS[o] || !AIRPORTS[d] || o === d) return null;
  const p = PROGRAMS.find(x => x.id === progId);
  if (!p) return null;
  const dist = gcMiles(o, d);
  if (dist == null) return null;
  const r = p.calc(dist, o, d);
  if (!r) return null;
  return {
    eco: r.eco != null ? r.eco : null,
    biz: r.biz != null ? r.biz : null,
    dyn: !!r.dyn,
    user: !!r.user,
    dist: Math.round(dist)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIRPORTS, PROGRAMS, gcMiles, regionOf, computeMile };
}
