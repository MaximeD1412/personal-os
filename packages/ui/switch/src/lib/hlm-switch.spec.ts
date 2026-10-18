import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HlmFieldImports } from '@personal-os/ui/field';
import { HlmSwitch } from './hlm-switch';

@Component({
  imports: [HlmSwitch, HlmFieldImports],
  template: `
    <div hlmField orientation="horizontal">
      <hlm-switch inputId="controle" aria-describedby="note" />
      <label hlmFieldLabel for="controle">Rappels</label>
      <p hlmFieldDescription id="aide">Un rappel la veille.</p>
    </div>
    <p id="note">Note</p>
  `,
})
class Hote {}

describe('HlmSwitch dans un FormField', () => {
  it("relie l'aide du champ et la description donnée au contrôle focalisable", () => {
    const fixture = TestBed.createComponent(Hote);
    fixture.detectChanges();
    const controle: HTMLElement = fixture.nativeElement.querySelector('[role=switch]');

    expect(controle.getAttribute('aria-describedby')?.split(' ').sort()).toEqual([
      'aide',
      'note',
    ]);
  });
});
