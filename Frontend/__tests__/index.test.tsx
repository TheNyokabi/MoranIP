import { render, screen } from '@testing-library/react'
import Home from '../src/app/page'

describe('Home Page', () => {
    it('renders system operational status', () => {
        render(<Home />)
        const statusElement = screen.getByText(/System Operational/i)
        expect(statusElement).toBeInTheDocument()
    })
})
