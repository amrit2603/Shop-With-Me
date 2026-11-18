import {act,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it} from 'vitest';
import ProductActions from '../src/components/ProductActions';
import {toggleSavedProduct} from '../src/utils/savedProducts';
beforeEach(()=>{sessionStorage.clear();sessionStorage.setItem('vyumi_tab_user',JSON.stringify({id:'alice'}));});
it('updates the save indicator when the product or room changes',()=>{
 const a={id:'a',name:'Lamp'},b={id:'b',name:'Speaker'};
 toggleSavedProduct(a,'room-one');
 const ui=(product,roomId)=><MemoryRouter><ProductActions product={product} roomId={roomId}/></MemoryRouter>;
 const {rerender}=render(ui(a,'room-one'));
 expect(screen.getByRole('button',{name:/save.*for me/i})).toHaveAttribute('aria-pressed','true');
 rerender(ui(b,'room-one'));
 expect(screen.getByRole('button',{name:/save.*for me/i})).toHaveAttribute('aria-pressed','false');
 act(()=>toggleSavedProduct(b,'room-one'));
 expect(screen.getByRole('button',{name:/save.*for me/i})).toHaveAttribute('aria-pressed','true');
 rerender(ui(a,'room-two'));
 expect(screen.getByRole('button',{name:/save.*for me/i})).toHaveAttribute('aria-pressed','false');
});
