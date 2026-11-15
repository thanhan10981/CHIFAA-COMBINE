"""Fallback workbook builder: artifact-tool runtime is unavailable on this host.
Creates source tables only; application calculations remain in shared/domain.js.
"""
from pathlib import Path
import json, sys, zipfile, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.tools'))
import xlsxwriter

out = ROOT / 'output' / 'chifaa-dev'
schema = json.loads((out / 'schema.json').read_text(encoding='utf-8'))
file = out / 'CHIFAA_DEV.xlsx'
book = xlsxwriter.Workbook(str(file))
book.set_properties({'title': 'CHIFAA COMBINE — DEV', 'subject': 'Workbook nguồn rỗng cho ứng dụng Apps Script', 'author': 'CHIFAA'})
header = book.add_format({'font_name':'Arial','font_size':10,'bold':True,'font_color':'#FFFFFF','bg_color':'#17283D','valign':'vcenter','align':'center','text_wrap':True,'bottom':1,'bottom_color':'#E97825'})
meta = book.add_format({'font_name':'Arial','font_size':10,'font_color':'#7A8798','num_format':'@'})
text = book.add_format({'font_name':'Arial','font_size':10,'font_color':'#245B9A','num_format':'@'})
number = book.add_format({'font_name':'Arial','font_size':10,'font_color':'#245B9A','num_format':'#,##0.00;[Red](#,##0.00);0.00'})
title = book.add_format({'font_name':'Arial','font_size':16,'bold':True,'font_color':'#17283D'})
body = book.add_format({'font_name':'Arial','font_size':11,'font_color':'#384C61','valign':'top','text_wrap':True})
muted = book.add_format({'font_name':'Arial','font_size':10,'font_color':'#7A8798','valign':'top','text_wrap':True})
guide=book.add_worksheet('HUONG_DAN')
guide.hide_gridlines(2);guide.set_tab_color('#17283D');guide.set_column('A:A',3);guide.set_column('B:E',22);guide.set_row(1,28)
guide.merge_range('B2:E2','CHIFAA COMBINE',title)
guide.merge_range('B4:E4','Workbook nguồn — môi trường dev',body)
guide.insert_image('B6',str(ROOT/'assets/logo-chifaa-navy-v3.png'),{'x_scale':0.12,'y_scale':0.12,'object_position':3})
guide.merge_range('C7:E9','Bảng mới chưa có dữ liệu nghiệp vụ. Không chứa mật khẩu, email quản trị hay số liệu minh họa.',body)
notes=[
('B15:E16','1. Nhập file này thành Google Sheets. Giữ nguyên tên tab và hàng header.'),
('B18:E19','2. Cấu hình Apps Script bằng ID bảng vừa tạo rồi chạy setup_ để tạo admin và bảo vệ vùng.'),
('B21:E22','3. Nhập danh mục trong app trước: vật tư, món, điểm bán, nhân viên, công thức.'),
('B24:E26','Chỉ sửa cột nội dung được cho phép. ID, phiên bản, nhật ký và phiếu đã ghi do ứng dụng quản lý. Dùng đảo phiếu để sửa giao dịch.'),
('B28:E30','Nguồn cấu trúc: 3 prompt và HTML do chủ dự án cung cấp. Đây là bản dev, chưa nghiệm thu Google hoặc bàn giao khách hàng.')]
for rng,value in notes:guide.merge_range(rng,value,body if rng!='B28:E30' else muted)
expected={}
for module,definition in schema['modules'].items():
    sheet=book.add_worksheet(module);sheet.hide_gridlines(2);sheet.freeze_panes(1,0);sheet.set_row(0,36)
    fields=definition['fields'];headers=schema['meta']+list(fields)
    expected[module]=headers
    sheet.write_row(0,0,headers,header)
    for col,key in enumerate(headers):
        f=fields.get(key)
        width=max(15,min(28,len(key)+3))
        sheet.set_column(col,col,width,meta if f is None else number if f['type']=='number' else text)
        if f and f['type']=='select':sheet.data_validation(1,col,1000,col,{'validate':'list','source':f['options'],'error_type':'stop','error_message':'Chọn giá trị từ danh sách.'})
        if f and f['type']=='number' and 'min'in f:sheet.data_validation(1,col,1000,col,{'validate':'decimal','criteria':'>=','value':f['min'],'error_type':'stop'})
    sheet.autofilter(0,0,0,len(headers)-1)
for name,headers in schema['system'].items():
    sheet=book.add_worksheet(name);sheet.hide_gridlines(2);sheet.freeze_panes(1,0);sheet.set_row(0,36);sheet.set_column(0,len(headers)-1,24,meta);sheet.write_row(0,0,headers,header);expected[name]=headers
book.close()
# Verify the exported OpenXML rather than assuming successful save proves its schema.
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(file) as archive:
    strings=ET.fromstring(archive.read('xl/sharedStrings.xml'))
    values=[''.join(t.itertext()) for t in strings.findall('m:si',ns)]
    workbook=ET.fromstring(archive.read('xl/workbook.xml'))
    sheets=workbook.findall('m:sheets/m:sheet',ns)
    assert len(sheets)==len(expected)+1
    for index,s in enumerate(sheets,1):
        if s.attrib['name'] not in expected:continue
        xml=ET.fromstring(archive.read(f'xl/worksheets/sheet{index}.xml'))
        row=xml.find('m:sheetData/m:row',ns)
        actual=[values[int(c.find('m:v',ns).text)] for c in row.findall('m:c',ns)]
        assert actual==expected[s.attrib['name']],s.attrib['name']
        assert len(xml.findall('m:sheetData/m:row',ns))==1,'Unexpected sample data'
    assert not any(b'<f>'in archive.read(n) for n in archive.namelist() if n.startswith('xl/worksheets/'))
report={'file':str(file),'sheets':len(expected)+1,'businessTables':len(schema['modules']),'systemTables':len(schema['system']),'schemaVerified':True,'businessRows':0,'formulas':0,'visualQA':'Not rendered: artifact-tool runtime and spreadsheet renderer unavailable. OpenXML structure checked; Google/Excel visual check remains pending.'}
(out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
