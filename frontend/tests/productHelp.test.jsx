import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ShoppingHostPanel from "../src/components/party/ShoppingHostPanel";
const room={id:"room",products:[{id:"one",name:"Lamp"},{id:"two",name:"Speaker"}]};
it("asks about the displayed product and compares it without extra steps",()=>{
  const send=vi.fn();
  render(<ShoppingHostPanel room={room} currentProductId="two" send={send} />);
  expect(screen.getByRole("button",{name:"Ask VYUMI"})).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Ask about this product"),{target:{value:"  What does it cost?  "}});
  fireEvent.click(screen.getByRole("button",{name:"Ask VYUMI"}));
  expect(send).toHaveBeenCalledWith("host",{action:"question",productId:"two",query:"What does it cost?"});
  fireEvent.click(screen.getByText("Compare with another product"));
  expect(screen.getByLabelText("Another product")).toHaveValue("one");
  fireEvent.click(screen.getByRole("button",{name:"Compare products",exact:true}));
  expect(send).toHaveBeenLastCalledWith("host",{action:"compare",a:"two",b:"one"});
  expect(screen.getByText("Any budget")).not.toBeVisible();
});
it("shows comparison results, dismisses replies and handles single-product/offline rooms",()=>{
  const dismiss=vi.fn();
  render(<ShoppingHostPanel room={{...room,products:room.products.slice(0,1)}} currentProductId="one" disabled send={vi.fn()} onDismiss={dismiss} hostNote={{text:"Known details",rows:[["Price","₹10","Unknown"]]}}/>);
  expect(screen.getByRole("table",{name:"Product comparison"})).toHaveTextContent("Unknown");
  fireEvent.click(screen.getByRole("button",{name:"Dismiss answer"}));
  expect(dismiss).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("Compare with another product"));
  expect(screen.getByText("Add another product to compare.")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Ask about this product"),{target:{value:"Price"}});
  expect(screen.getByRole("button",{name:"Ask VYUMI"})).toBeDisabled();
});

it("keeps unsolicited disagreement tips out of the product question area",()=>{
  render(<ShoppingHostPanel room={room} currentProductId="one" send={vi.fn()} hostNote={{kind:"disagreement",text:"Opinions are split"}}/>);
  expect(screen.queryByText("Opinions are split")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Ask about this product")).toBeVisible();
});
