/* Arruda PDV - atualização estoque e orçamento PDF - v2 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const clean = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = s => Number(String(s).trim().replace(',','.'));
  const getProduct = id => db.produtos.find(p=>String(p.id)===String(id));
  let editing = null;
  function saveOrWarn(){ if(!save()) throw Error('Não foi possível salvar as alterações.'); }
  function productRow(p){
    return `<tr><td>${clean(p.nome)}</td><td>${fmt(p.custo)}</td><td>${fmt(p.preco)}</td><td>${p.estoque}</td><td><button type="button" onclick="arrudaEditarProduto('${p.id}')">Editar</button> <button type="button" onclick="arrudaReporProduto('${p.id}')">Repor</button> <button type="button" onclick="arrudaExcluirProduto('${p.id}')">Excluir</button></td></tr>`;
  }
  function updateProductTable(){const target=$('tabelaProdutos');if(target)target.innerHTML=db.produtos.map(productRow).join('')||'<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';}
  const originalRender=window.render;
  window.render=function(){originalRender();updateProductTable();};
  window.arrudaEditarProduto=function(id){
    const p=getProduct(id);if(!p)return alert('Produto não encontrado.');
    editing=String(id);
    $('nome').value=p.nome;$('custo').value=p.custo;$('preco').value=p.preco;$('estoque').value=p.estoque;
    const b=$('arrudaSalvarProduto');b.textContent='✓ Salvar alterações';
    $('arrudaCancelarProduto').hidden=false;
    tab('produtos');$('nome').focus();
  };
  window.arrudaCancelarProduto=function(){editing=null;['nome','custo','preco','estoque'].forEach(id=>$(id).value='');$('arrudaSalvarProduto').textContent='+ Cadastrar';$('arrudaCancelarProduto').hidden=true;};
  window.arrudaSalvarProduto=function(){
    if(editing===null){cadastrar();return;}
    const p=getProduct(editing);if(!p)return alert('Produto não encontrado.');
    const nome=$('nome').value.trim(), custo=number($('custo').value),preco=number($('preco').value),estoque=number($('estoque').value);
    if(!nome||$('custo').value.trim()===''||$('preco').value.trim()===''||$('estoque').value.trim()===''||!Number.isFinite(custo)||custo<0||!Number.isFinite(preco)||preco<=0||!Number.isSafeInteger(estoque)||estoque<0)return alert('Confira nome, custo, preço e quantidade inteira não negativa.');
    const old={...p};Object.assign(p,{nome,custo,preco,estoque});
    if(!save()){Object.assign(p,old);return;}
    window.arrudaCancelarProduto();render();alert('Produto atualizado!');
  };
  window.arrudaReporProduto=function(id){
    const p=getProduct(id);if(!p)return;
    const raw=prompt('Quantas unidades deseja adicionar ao estoque de '+p.nome+'?','1');if(raw===null)return;
    const q=number(raw);if(!Number.isSafeInteger(q)||q<=0)return alert('Informe um número inteiro maior que zero.');
    const old=p.estoque;p.estoque+=q;if(!save())p.estoque=old;render();
  };
  window.arrudaExcluirProduto=function(id){
    const p=getProduct(id);if(!p)return;
    if(!confirm('Excluir o produto '+p.nome+'? Vendas anteriores permanecerão no histórico.'))return;
    const index=db.produtos.indexOf(p);db.produtos.splice(index,1);
    if(!save()){db.produtos.splice(index,0,p);return;}
    for(let i=cart.length-1;i>=0;i--)if(String(cart[i].id)===String(id))cart.splice(i,1);
    if(editing===String(id))window.arrudaCancelarProduto();
    for(let i=orcLinhas.length-1;i>=0;i--)if(String(orcLinhas[i].id)===String(id))orcLinhas.splice(i,1);
    render();
  };
  const register=$('produtos')?.querySelector('button[onclick="cadastrar()"]');
  if(register){register.id='arrudaSalvarProduto';register.setAttribute('onclick','arrudaSalvarProduto()');const cancel=document.createElement('button');cancel.id='arrudaCancelarProduto';cancel.className='secondary';cancel.textContent='Cancelar edição';cancel.hidden=true;cancel.onclick=window.arrudaCancelarProduto;register.after(cancel);}
  // PDF via jsPDF. Requires internet the first time to load library.
  function loadPDF(){
    if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      script.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(Error('Biblioteca PDF indisponível'));
      script.onerror=()=>reject(Error('Sem conexão para carregar o gerador de PDF'));document.head.appendChild(script);
    });
  }
  function buildPDF(o,jsPDF){
    const doc=new jsPDF({unit:'mm',format:'a4'}),W=210,left=16,right=194;
    let y=18;
    const line=(str,size=10,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);for(const s of doc.splitTextToSize(String(str),W-32)){if(y>274){doc.addPage();y=20;}doc.text(s,left,y);y+=size*.48+2;}};
    doc.setFillColor(5,89,155);doc.rect(0,0,210,34,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(21);doc.text('ARRUDA PISCINAS',16,19);doc.setFontSize(10);doc.text('ORCAMENTO COMERCIAL',16,27);doc.setTextColor(30,48,67);y=44;
    line('Orcamento N° '+o.id,12,true);line('Emissao: '+new Date(o.data).toLocaleDateString('pt-BR')+'  |  Validade: '+Math.max(1,Number(o.validade)||7)+' dia(s)',10);
    const due=new Date(new Date(o.data).getTime()+Number(o.validade||7)*86400000);line('Valido ate: '+due.toLocaleDateString('pt-BR'),10);
    y+=3;line('CLIENTE',12,true);line(o.cliente?.nome||'Nao informado',11);if(o.cliente?.whatsapp)line('WhatsApp: '+o.cliente.whatsapp);if(o.cliente?.endereco)line('Endereco: '+o.cliente.endereco);y+=5;
    doc.setFillColor(229,242,251);doc.rect(16,y-6,178,9,'F');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('PRODUTO',19,y);doc.text('QTD',121,y);doc.text('UNIT.',142,y);doc.text('SUBTOTAL',168,y);y+=9;
    for(const item of o.itens){const lines=doc.splitTextToSize(String(item.nome),92);const h=Math.max(11,lines.length*5+4);if(y+h>270){doc.addPage();y=20;}doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(lines,19,y);doc.text(String(item.q),121,y);doc.text(fmt(item.preco),142,y);doc.text(fmt(item.q*item.preco),168,y);y+=h;doc.setDrawColor(225,233,240);doc.line(16,y-5,194,y-5);}
    if(y>258){doc.addPage();y=20;}y+=6;doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('TOTAL: '+fmt(o.total),194,y,{align:'right'});y+=13;
    if(o.obs){line('OBSERVACOES',11,true);line(o.obs,10);y+=4;}
    line('Orcamento nao fiscal. Nao reserva estoque.',9);
    const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(110,125,140);doc.text('Arruda Piscinas  |  Pagina '+i+' de '+pages,105,290,{align:'center'});}
    return doc;
  }
  const filename=o=>'orcamento-arruda-'+o.id+'.pdf';
  async function pdfAction(o,share){
    try{
      const jsPDF=await loadPDF(),doc=buildPDF(o,jsPDF),name=filename(o);
      if(share){const blob=doc.output('blob'),file=new File([blob],name,{type:'application/pdf'});
        if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'Orcamento Arruda Piscinas'});return;}catch(e){if(e.name==='AbortError')return;}}
        doc.save(name);alert('O PDF foi baixado. Abra o arquivo e use Compartilhar para enviar pelo WhatsApp.');return;
      }
      doc.save(name);
    }catch(e){console.error(e);alert('Não foi possível gerar o PDF: '+e.message+'. Confira sua conexão com a internet e tente novamente.');}
  }
  function createQuote(){
    const c=db.clientes.find(x=>String(x.id)===String($('orcCliente').value));if(!c)return alert('Cadastre e selecione um cliente.');
    if(!orcLinhas.length)return alert('Adicione pelo menos um produto.');
    const itens=[];for(const l of orcLinhas){const p=getProduct(l.id);if(!p||!Number.isSafeInteger(l.q)||l.q<=0||!Number.isFinite(l.preco)||l.preco<0)return alert('Confira os itens do orçamento.');itens.push({nome:p.nome,q:l.q,preco:l.preco});}
    const o={id:Date.now(),data:new Date().toISOString(),cliente:{...c},itens,total:itens.reduce((s,i)=>s+i.q*i.preco,0),validade:Math.max(1,Number($('orcValidade').value)||7),obs:$('orcObs').value.trim()};
    db.orcamentos.push(o);if(!save()){db.orcamentos.pop();return null;}render();return o;
  }
  window.arrudaNovoPDF=function(share){const o=createQuote();if(o)pdfAction(o,share);};
  window.arrudaPDFSalvo=function(id,share){const o=db.orcamentos.find(x=>String(x.id)===String(id));if(o)pdfAction(o,share);else alert('Orçamento não encontrado.');};
  const quoteBtn=$('orcamentos')?.querySelector('button[onclick="gerarOrcamento()"]');
  if(quoteBtn){quoteBtn.textContent='⬇ Baixar PDF';quoteBtn.setAttribute('onclick','arrudaNovoPDF(false)');const share=document.createElement('button');share.className='primary';share.textContent='↗ Compartilhar PDF';share.onclick=()=>window.arrudaNovoPDF(true);quoteBtn.after(share);}
  const oldExtras=window.renderExtras;
  window.renderExtras=function(){oldExtras();const list=$('listaOrcamentos');if(list){list.querySelectorAll('button[onclick^="reimprimir("]').forEach(btn=>{const id=btn.getAttribute('onclick').match(/\((\d+)\)/)?.[1];if(!id)return;btn.textContent='Baixar PDF';btn.setAttribute('onclick',`arrudaPDFSalvo('${id}',false)`);const share=document.createElement('button');share.textContent='Compartilhar';share.setAttribute('onclick',`arrudaPDFSalvo('${id}',true)`);btn.after(share);});}};
  render();
})();
